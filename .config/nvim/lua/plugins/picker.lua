vim.api.nvim_create_autocmd("PackChanged", {
	callback = function(ev)
		local name, kind = ev.data.spec.name, ev.data.kind

		if name == "fff.nvim" and (kind == "install" or kind == "update") then
			if not ev.data.active then
				vim.cmd.packadd("fff.nvim")
			end

			require("fff.download").download_or_build_binary()
		end
	end,
})

vim.g.fff = {
	lazy_sync = true,
}

vim.g.lazygit_floating_window_scaling_factor = 1.0

vim.pack.add({
	{ src = "https://github.com/dmtrKovalenko/fff.nvim" },
	{ src = "https://github.com/kdheepak/lazygit.nvim" },
}, { confirm = false })

vim.schedule(function()
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
		require("fff").find_files()
	end, { silent = true, noremap = true })

	vim.keymap.set("n", "<leader>fg", function()
		require("fff").live_grep()
	end, { silent = true, noremap = true })

	vim.keymap.set("n", "<leader>lg", "<cmd>LazyGit<CR>", { silent = true, noremap = true })
end)
