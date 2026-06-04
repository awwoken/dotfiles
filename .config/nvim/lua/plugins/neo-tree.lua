vim.pack.add({
	{ src = "https://github.com/nvim-neo-tree/neo-tree.nvim" },
	{ src = "https://github.com/nvim-lua/plenary.nvim" },
	{ src = "https://github.com/MunifTanjim/nui.nvim" },
}, { confirm = false })

vim.schedule(function()
	local NeoTree = require("neo-tree")

	NeoTree.setup({
		close_if_last_window = true,
		log_level = vim.log.levels.WARN,
		window = {
			position = "right",
			mappings = {
				["l"] = "open",
			},
		},
		filesystem = {
			follow_current_file = {
				enabled = true,
			},
			use_libuv_file_watcher = true,
		},
	})

	vim.keymap.set("n", "<leader>e", function()
		if vim.bo.filetype == "neo-tree" then
			vim.cmd.wincmd("p")
			return
		end

		require("neo-tree.command").execute({
			action = "focus",
			source = "filesystem",
			position = "right",
			reveal = true,
		})
	end, { silent = true, noremap = true })
end)
