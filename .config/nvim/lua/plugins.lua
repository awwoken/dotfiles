local path_package = vim.fn.stdpath("data") .. "/site"
local mini_path = path_package .. "/pack/deps/start/mini.nvim"

if not vim.loop.fs_stat(mini_path) then
	vim.cmd('echo "Installing `mini.nvim`" | redraw')

  -- stylua: ignore
	local clone_cmd = {
		"git", "clone", "--filter=blob:none",
		"https://github.com/nvim-mini/mini.nvim", mini_path
	}
	vim.fn.system(clone_cmd)

	vim.cmd("packadd mini.nvim | helptags ALL")
	vim.cmd('echo "Installed `mini.nvim`" | redraw')
end

local MiniDeps = require("mini.deps")

-- core
MiniDeps.add({ source = "echasnovski/mini.nvim" })
MiniDeps.add({ source = "stevearc/conform.nvim" })

-- lsp
MiniDeps.add({ source = "williamboman/mason.nvim" })
MiniDeps.add({ source = "WhoIsSethDaniel/mason-tool-installer.nvim" })
MiniDeps.add({ source = "neovim/nvim-lspconfig" })

-- highlighting
MiniDeps.add({ source = "nvim-treesitter/nvim-treesitter" })
MiniDeps.add({ source = "rose-pine/neovim" })
-- MiniDeps.add({
-- 	source = "zenbones-theme/zenbones.nvim",
-- 	depends = { "rktjmp/lush.nvim" },
-- })
-- MiniDeps.add({ source = "EdenEast/nightfox.nvim" })

-- metrics
MiniDeps.add({ source = "wakatime/vim-wakatime" })

MiniDeps.setup()

MiniDeps.later(function()
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

MiniDeps.later(function()
	local Mason = require("mason")

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
    -- stylua: ignore
    ensure_installed = {
      "stylua", "prettierd", "css-lsp", "html-lsp", "tailwindcss-language-server", "typescript-language-server",
      "lua-language-server", "json-lsp", "shfmt", "clangd", "eslint-lsp", "rust-analyzer"
    },
		auto_update = true,
	})

  -- stylua: ignore
  vim.lsp.enable({
    "lua_ls", "ts_ls", "tailwindcss", "cssls", "html", "jsonls", "clangd", "rust_analyzer"
  })

	vim.lsp.config("ts_ls", { -- prioritize git marker to share one lsp through monorepo
		root_markers = { ".git", "tsconfig.json", "jsconfig.json", "package.json" },
	})

	vim.lsp.config("eslint-lsp", { -- pick correct configuration file in monorepo
		workingDirectory = { mode = "location" },
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
end)

MiniDeps.later(function()
	local MiniCompletion = require("mini.completion")

	-- Don't show 'Text' suggestions
	local process_items_opts = { kind_priority = { Text = -1 } }
	local process_items = function(items, base)
		return MiniCompletion.default_process_items(items, base, process_items_opts)
	end

	MiniCompletion.setup({
		lsp_completion = {
			process_items = process_items,
			source_func = "omnifunc",
			auto_setup = false,
		},
		fallback_action = function() end,
	})

	-- Set up LSP part of completion
	local on_attach = function(args)
		vim.bo[args.buf].omnifunc = "v:lua.MiniCompletion.completefunc_lsp"
	end
	vim.api.nvim_create_autocmd("LspAttach", { callback = on_attach })

	vim.lsp.config("*", {
		capabilities = MiniCompletion.get_lsp_capabilities(),
	})

	-- Bind C-j and C-k to move up and down
	vim.keymap.set("i", "<C-j>", [[pumvisible() ? "\<C-n>" : "\<C-j>"]], { expr = true })
	vim.keymap.set("i", "<C-k>", [[pumvisible() ? "\<C-p>" : "\<C-k>"]], { expr = true })
end)

MiniDeps.later(function()
	local MiniExtra = require("mini.extra")

	MiniExtra.setup()

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
end)

MiniDeps.later(function()
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

MiniDeps.later(function()
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

MiniDeps.later(function()
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

MiniDeps.later(function()
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
