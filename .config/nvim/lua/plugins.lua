vim.pack.add({
	-- core
	{ src = "https://github.com/nvim-mini/mini.nvim" },
	{ src = "https://github.com/stevearc/conform.nvim" },

	-- lsp
	{ src = "https://github.com/williamboman/mason.nvim" },
	{ src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
	{ src = "https://github.com/neovim/nvim-lspconfig" },

	-- highlighting
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter" },
	{ src = "https://github.com/rose-pine/neovim", name = "rose-pine" },

	-- metrics
	{ src = "https://github.com/wakatime/vim-wakatime" },
}, { confirm = false })

vim.schedule(function()
	local Treesitter = require("nvim-treesitter")

	Treesitter.setup({
    --stylua: ignore
		ensure_installed = {
			"c", "cpp", "lua", "vim", "vimdoc", "query", "markdown", "markdown_inline", "vue", "graphql",
      "regex", "bash", "html", "css", "rust", "javascript", "typescript", "tsx", "json",
    },
		highlight = {
			disable = function(_, bufnr)
				return vim.api.nvim_buf_line_count(bufnr) > 5000
			end,
			enable = true,
		},
		sync_install = false,
	})
	vim.bo.indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
end)

vim.schedule(function()
	local MiniExtra = require("mini.extra")
	local Mason = require("mason")

	MiniExtra.setup()

	Mason.setup({
		ui = {
			icons = {
				package_installed = "[x]",
				package_pending = "[?]",
				package_uninstalled = "[]",
			},
		},
	})

	local MasonToolInstaller = require("mason-tool-installer")

	MasonToolInstaller.setup({
		ensure_installed = {
			"stylua",
			"prettierd",
			"css-lsp",
			"html-lsp",
			"tailwindcss-language-server",
			"typescript-language-server",
			"lua-language-server",
			"json-lsp",
			"shfmt",
			"clangd",
			"eslint-lsp",
			"rust-analyzer",
			"taplo",
		},
		auto_update = true,
	})

	vim.lsp.config("ts_ls", { -- prioritize git marker to share one lsp through monorepo
		root_markers = { ".git", "tsconfig.json", "jsconfig.json", "package.json" },
	})

	vim.lsp.config("eslint", { -- pick correct configuration file in monorepo
		settings = {
			workingDirectory = { mode = "location" },
		},
	})

	vim.lsp.config("clangd", {
		cmd = { "clangd", "--pretty", "--background-index", "--clang-tidy", "--log=verbose" },
	})

	vim.lsp.config("lua_ls", {
		settings = {
			Lua = {
				runtime = { version = "LuaJIT" },
				workspace = {
					checkThirdParty = false,
					library = { vim.env.VIMRUNTIME },
				},
				telemetry = { enable = false },
			},
		},
	})

	local extraMap = function(lhs, rhs, buf)
		vim.keymap.set("n", lhs, rhs, { buffer = buf, silent = true, nowait = true })
	end

	vim.api.nvim_create_autocmd("LspAttach", {
		callback = function(args)
			local client = vim.lsp.get_client_by_id(args.data.client_id)

			if client ~= nil and client:supports_method("textDocument/completion") then
				vim.lsp.completion.enable(true, client.id, args.buf, { autotrigger = true })
			end

			extraMap("gd", function()
				MiniExtra.pickers.lsp({ scope = "definition" })
			end, args.buf)
			extraMap("gr", function()
				MiniExtra.pickers.lsp({ scope = "references" })
			end, args.buf)
			extraMap("gt", function()
				MiniExtra.pickers.lsp({ scope = "type_definition" })
			end, args.buf)
		end,
		group = vim.api.nvim_create_augroup("UserLspConfig", {}),
	})

	vim.keymap.set("i", "<C-Space>", function()
		vim.lsp.completion.get()
	end, { silent = true })

	-- Bind C-j and C-k to move up and down
	vim.keymap.set("i", "<C-j>", [[pumvisible() ? "\<C-n>" : "\<C-j>"]], { expr = true })
	vim.keymap.set("i", "<C-k>", [[pumvisible() ? "\<C-p>" : "\<C-k>"]], { expr = true })

	vim.lsp.enable({
		"lua_ls",
		"ts_ls",
		"tailwindcss",
		"cssls",
		"html",
		"jsonls",
		"clangd",
		"rust_analyzer",
		"eslint",
	})
end)

vim.schedule(function()
	local Conform = require("conform")

	Conform.setup({
		formatters_by_ft = {
			lua = { "stylua" },
			css = { "prettierd" },
			html = { "prettierd" },
			javascript = { "prettierd" },
			typescript = { "prettierd" },
			javascriptreact = { "prettierd" },
			typescriptreact = { "prettierd" },
			rust = { "rustfmt" },
			json = { "prettierd" },
			toml = { "taplo" },
			graphql = { "prettierd" },
			sh = { "shfmt" },
			zsh = { "shfmt" },
		},
	})

	vim.keymap.set({ "n", "v" }, "<leader>l", function()
		Conform.format({
			lsp_fallback = false,
			timeout_ms = 1000,
		})
	end, { silent = true })
end)

vim.schedule(function()
	local MiniFiles = require("mini.files")

	vim.keymap.set("n", "<leader>e", function()
		local bufname = vim.api.nvim_buf_get_name(0)

		if bufname:match("^minifiles://") then
			-- Already in MiniFiles buffer, ignore
			return
		end

		MiniFiles.open(bufname)
		MiniFiles.reveal_cwd()
	end, { silent = true, noremap = true })

	vim.api.nvim_create_autocmd("BufEnter", {
		callback = function()
			if vim.api.nvim_buf_get_name(0):match("^minifiles://") then
				vim.keymap.set("n", "<leader>w", function()
					MiniFiles.synchronize()
				end, { buffer = true, silent = true, noremap = true })
			end
		end,
	})

	MiniFiles.setup({
		mappings = {
			go_in_plus = "l",
			go_in = "",
		},
	})
end)

vim.schedule(function()
	local MiniPick = require("mini.pick")

	MiniPick.setup({
		mappings = {
			move_up = "<C-k>",
			move_down = "<C-j>",
		},
		options = {
			use_cache = true,
		},
	})
	vim.ui.select = MiniPick.ui_select

	vim.keymap.set("n", "<leader>ff", function()
		MiniPick.builtin.files({ tool = "fd" })
	end, { silent = true, noremap = true })

	vim.keymap.set("n", "<leader>fg", function()
		MiniPick.builtin.grep_live({ tool = "rg" })
	end, { silent = true, noremap = true })
end)

vim.schedule(function()
	local MiniMove = require("mini.move")

	MiniMove.setup({
		mappings = {
			-- Move visual selection in Visual mode
			left = "<S-Tab>",
			right = "<Tab>",
			down = "J",
			up = "K",

			-- Move current line in Normal mode
			line_down = "J",
			line_up = "K",
		},
	})

	local MiniPairs = require("mini.pairs")
	MiniPairs.setup()
end)
