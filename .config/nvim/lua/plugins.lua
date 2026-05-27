vim.api.nvim_create_autocmd("PackChanged", {
	callback = function(ev)
		local name, kind = ev.data.spec.name, ev.data.kind

		if name == "fff.nvim" and (kind == "install" or kind == "update") then
			if not ev.data.active then
				vim.cmd.packadd("fff.nvim")
			end

			require("fff.download").download_or_build_binary()
		end
	end,
})

vim.g.fff = {
	lazy_sync = true,
}

vim.pack.add({
	-- core
	{ src = "https://github.com/nvim-mini/mini.nvim" },
	{ src = "https://github.com/stevearc/conform.nvim" },
	{ src = "https://github.com/dmtrKovalenko/fff.nvim" },
	{ src = "https://github.com/Saghen/blink.cmp", version = vim.version.range("1") },

	-- lsp
	{ src = "https://github.com/williamboman/mason.nvim" },
	{ src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
	{ src = "https://github.com/neovim/nvim-lspconfig" },

	-- highlighting
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter" },
	{ src = "https://github.com/navarasu/onedark.nvim" },

	-- metrics
	{ src = "https://github.com/wakatime/vim-wakatime" },
}, { confirm = false })

require("blink.cmp").setup({
	keymap = {
		preset = "default",
		["<C-j>"] = { "select_next", "fallback" },
		["<C-k>"] = { "select_prev", "fallback" },
	},
	completion = {
		documentation = {
			auto_show = true,
			auto_show_delay_ms = 500,
			window = { border = "none" },
		},
		menu = { border = "none" },
	},
	sources = {
		default = { "lsp", "path", "snippets", "buffer" },
	},
	fuzzy = {
		implementation = "rust",
	},
})

vim.schedule(function()
	local Treesitter = require("nvim-treesitter")

	Treesitter.setup({
    --stylua: ignore
		ensure_installed = {
			"c", "cpp", "lua", "vim", "vimdoc", "query", "markdown", "markdown_inline", "vue", "graphql",
      "regex", "bash", "html", "css", "rust", "javascript", "typescript", "tsx", "json", "yaml", "prisma",
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
			"prisma-language-server",
			"shfmt",
			"clangd",
			"eslint-lsp",
			"oxlint",
			"rust-analyzer",
			"taplo",
		},
		auto_update = true,
	})

	vim.lsp.config("*", {
		capabilities = require("blink.cmp").get_lsp_capabilities(),
	})

	vim.lsp.config("ts_ls", { -- prioritize git marker to share one lsp through monorepo
		root_markers = { ".git", "tsconfig.json", "jsconfig.json", "package.json" },
	})

	vim.lsp.config("eslint", { -- pick correct configuration file in monorepo
		settings = {
			workingDirectory = { mode = "location" },
		},
	})

	vim.lsp.config("oxlint", {
		root_dir = function(bufnr, on_dir)
			local root = vim.fs.root(bufnr, {
				{ ".oxlintrc.json", ".oxlintrc.jsonc", "oxlint.config.ts" },
				function(name, path)
					if name ~= "package.json" then
						return false
					end

					local ok, lines = pcall(vim.fn.readfile, vim.fs.joinpath(path, name))
					local content = ok and table.concat(lines, "\n") or ""

					return content:find('"oxlint"', 1, true) or content:find('"vite-plus"', 1, true)
				end,
			})

			if root then
				on_dir(root)
			end
		end,
		settings = {
			run = "onType",
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

	vim.lsp.enable({
		"lua_ls",
		"ts_ls",
		"tailwindcss",
		"cssls",
		"html",
		"jsonls",
		"prismals",
		"clangd",
		"rust_analyzer",
		"eslint",
		"oxlint",
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
		require("fff").find_files()
	end, { silent = true, noremap = true })

	vim.keymap.set("n", "<leader>fg", function()
		require("fff").live_grep()
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
