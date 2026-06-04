vim.pack.add({
	{ src = "https://github.com/nvim-treesitter/nvim-treesitter" },
}, { confirm = false })

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
