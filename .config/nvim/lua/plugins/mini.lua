vim.pack.add({
	{ src = "https://github.com/nvim-mini/mini.nvim" },
}, { confirm = false })

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

	local MiniAi = require("mini.ai")
	MiniAi.setup()

	local MiniGit = require("mini.git")
	MiniGit.setup()

	local MiniDiff = require("mini.diff")
	MiniDiff.setup({
		view = {
			style = "sign",
			signs = {
				add = "▌",
				change = "▌",
				delete = "▌",
			},
		},
	})

	local MiniStatusline = require("mini.statusline")
	MiniStatusline.setup()

	local MiniPairs = require("mini.pairs")
	MiniPairs.setup()
end)
