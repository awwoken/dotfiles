return {
	"catppuccin/nvim",
	lazy = false,
	name = "catppuccin",
	config = function()
		require("catppuccin").setup({
			transparent_background = true,
			float = {
				transparent = true,
				solid = false,
			},
			lsp_styles = {
				underlines = {
					errors = { "undercurl" },
					hints = { "undercurl" },
					warnings = { "undercurl" },
					information = { "undercurl" },
				},
			},
			integrations = {
				-- aerial = true,
				-- alpha = true,
				cmp = true,
				-- dashboard = true,
				-- flash = true,
				-- fzf = true,
				-- grug_far = true,
				gitsigns = true,
				-- headlines = true,
				illuminate = true,
				-- indent_blankline = { enabled = true },
				-- leap = true,
				-- lsp_trouble = true,
				mason = true,
				mini = true,
				-- navic = { enabled = true, custom_bg = "lualine" },
				-- neotest = true,
				-- neotree = true,
				noice = true,
				-- notify = true,
				snacks = true,
				-- telescope = true,
				-- treesitter_context = true,
				-- which_key = true,
			},
		})
		vim.cmd("colorscheme catppuccin-mocha")
	end,
}
