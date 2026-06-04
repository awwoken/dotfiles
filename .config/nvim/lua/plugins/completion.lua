vim.pack.add({
	{ src = "https://github.com/Saghen/blink.cmp", version = vim.version.range("1") },
}, { confirm = false })

require("blink.cmp").setup({
	keymap = {
		preset = "default",
		["<C-j>"] = { "select_next", "fallback" },
		["<C-k>"] = { "select_prev", "fallback" },
	},
	completion = {
		documentation = {
			auto_show = true,
			auto_show_delay_ms = 500,
			window = { border = "none" },
		},
		menu = { border = "none" },
	},
	sources = {
		default = { "lsp", "path", "snippets", "buffer" },
	},
	fuzzy = {
		implementation = "rust",
	},
})
