vim.pack.add({
	{ src = "https://github.com/navarasu/onedark.nvim" },
}, { confirm = false })

vim.cmd("colorscheme " .. "vim") -- Prevents flash before system theme set

local function apply_theme_overrides()
	local transparent_groups = {
		"Normal",
		"NormalNC",
		"SignColumn",
		"LineNr",
		"EndOfBuffer",
		"NormalFloat",
		"FloatBorder",
	}

	for _, group in ipairs(transparent_groups) do
		vim.api.nvim_set_hl(0, group, { bg = "none" })
	end

	vim.api.nvim_set_hl(0, "MiniDiffSignAdd", { fg = "#98c379", bg = "none" })
	vim.api.nvim_set_hl(0, "MiniDiffSignChange", { fg = "#e5c07b", bg = "none" })
	vim.api.nvim_set_hl(0, "MiniDiffSignDelete", { fg = "#e06c75", bg = "none" })
end

local function adapt_theme()
	require("onedark").setup({
		style = vim.o.background == "light" and "light" or "dark",
		transparent = true,
	})
	require("onedark").load()
	apply_theme_overrides()
end

vim.api.nvim_create_autocmd("OptionSet", {
	callback = adapt_theme,
	pattern = "background",
})

vim.api.nvim_create_autocmd("ColorScheme", {
	callback = apply_theme_overrides,
})

adapt_theme()
