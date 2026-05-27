vim.cmd("colorscheme " .. "vim") -- Prevents flash before system theme set

local function adapt_theme()
	require("onedark").setup({
		style = vim.o.background == "light" and "light" or "dark",
		transparent = true,
	})
	require("onedark").load()

	local groups = {
		"Normal",
		"NormalNC",
		"SignColumn",
		"LineNr",
		"EndOfBuffer",
		"NormalFloat",
		"FloatBorder",
	}

	for _, group in ipairs(groups) do
		vim.api.nvim_set_hl(0, group, { bg = "none" })
	end
end

vim.api.nvim_create_autocmd("OptionSet", {
	callback = adapt_theme,
	pattern = "background",
})

adapt_theme()
