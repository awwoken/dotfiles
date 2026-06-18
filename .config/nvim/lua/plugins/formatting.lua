vim.pack.add({
	{ src = "https://github.com/stevearc/conform.nvim" },
}, { confirm = false })

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
		-- format_on_save = {
		-- 	-- These options will be passed to conform.format()
		-- 	timeout_ms = 500,
		-- 	lsp_format = "fallback",
		-- },
	})

	vim.keymap.set({ "n", "v" }, "<leader>l", function()
		Conform.format({
			lsp_fallback = false,
			timeout_ms = 1000,
		})
	end, { silent = true })
end)
