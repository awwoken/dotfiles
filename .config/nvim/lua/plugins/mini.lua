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

	local MiniPairs = require("mini.pairs")
	MiniPairs.setup()
end)
