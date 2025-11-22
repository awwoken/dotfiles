return {
	{
		"nvim-mini/mini.pairs",
		event = "VeryLazy",
		opts = {
			modes = { insert = true, command = true, terminal = false },
			-- skip autopair when next character is one of these
			skip_next = [=[[%w%%%'%[%"%.%`%$]]=],
			-- skip autopair when the cursor is inside these treesitter nodes
			skip_ts = { "string" },
			-- skip autopair when next character is closing pair
			-- and there are more closing pairs than opening pairs
			skip_unbalanced = true,
			-- better deal with markdown code blocks
			markdown = true,
		},
	},
	{
		"nvim-mini/mini.move",
		keys = {
			{ "<S-Tab>", mode = { "n", "v" } },
			{ "<Tab>", mode = { "n", "v" } },
			{ "J", mode = { "n", "v" } },
			{ "K", mode = { "n", "v" } },
		},
		opts = {
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
		},
	},
	{
		"folke/ts-comments.nvim",
		opts = {},
	},
	{
		"lewis6991/gitsigns.nvim",
		dependencies = { "snacks.nvim" },
		opts = function()
			Snacks.toggle({
				name = "Git Signs",
				get = function()
					return require("gitsigns.config").config.signcolumn
				end,
				set = function(state)
					require("gitsigns").toggle_signs(state)
				end,
			})
		end,
	},
	{
		"wakatime/vim-wakatime",
		lazy = false,
	},
}
