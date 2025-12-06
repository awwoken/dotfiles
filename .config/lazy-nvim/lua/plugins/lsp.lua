return {
	{
		"williamboman/mason.nvim",
		config = function()
			require("mason").setup({
				ui = {
					icons = {
						package_installed = " ", -- checkmark
						package_pending = " ", -- question mark
						package_uninstalled = " ", -- cross
					},
				},
			})
		end,
	},
	{
		"WhoIsSethDaniel/mason-tool-installer.nvim",
		dependencies = { "williamboman/mason.nvim" },
		config = function()
			require("mason-tool-installer").setup({
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
					"pyright",
					"ruff",
					"eslint-lsp",
				},
				auto_update = true,
			})
		end,
	},
	{
		"mason-org/mason-lspconfig.nvim",
		opts = {},
	},
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
			"folke/snacks.nvim",
		},
		config = function()
			-- Define custom icons for diagnostics

			-- wide icons shift signcolumn layout
			-- local signs = {
			-- 	Error = "火", -- "danger" (kiken)
			-- 	Warn = "警", -- "warning" (keikai)
			-- 	Info = "情", -- "information" (jouhou)
			-- 	Hint = "助", -- "help/assistance" (tasuke)
			-- }

			local signs = {
				Error = "ｴ", -- E / Error
				Warn = "ﾜ", -- Wa / Warning
				Info = "ｲ", -- I / Info
				Hint = "ﾀ", -- Ta / Help
			}

			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
			end

			vim.diagnostic.config({
				underline = true,
				update_in_insert = false,
				virtual_text = {
					spacing = 4,
					source = "if_many",
					-- prefix = "●",
				},
				severity_sort = true,
			})

			local map = vim.keymap.set

			map("n", "<leader>d", vim.lsp.buf.hover, { desc = "Hover" })
			map("n", "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" })
			map("n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" })

			-- TypeScript — prefer git root in monorepos
			vim.lsp.config("ts_ls", {
				root_markers = { ".git", "tsconfig.json", "jsconfig.json", "package.json" },
			})

			-- ESLint — pick correct config in monorepo
			vim.lsp.config("eslint-lsp", {
				workingDirectory = { mode = "location" },
			})

			vim.lsp.config("clangd", {
				cmd = {
					"clangd",
					"--pretty",
					"--background-index",
					"--clang-tidy",
					"--log=verbose",
				},
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
		end,
	},
}
