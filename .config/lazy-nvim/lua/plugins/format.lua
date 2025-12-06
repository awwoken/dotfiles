return {
	"stevearc/conform.nvim",
	dependencies = { "mason.nvim" },
	lazy = true,
	cmd = "ConformInfo",
	keys = {
		{
			"<leader>l",
			function()
				require("conform").format({
					lsp_fallback = false,
					timeout_ms = 1000,
				})
			end,
			mode = { "n", "x" },
			desc = "Format Injected Langs",
		},
	},
	opts = {
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
			python = {
				"ruff_format",
				"ruff_organize_imports",
			},
			zsh = { "shfmt" },
			cpp = { "clang_format" },
		},
	},
}
