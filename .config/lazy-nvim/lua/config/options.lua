-- Load shared Vim config
vim.cmd("source ~/.vimrc")

-- Disable deprecation warnings (Neovim-only)
---@diagnostic disable-next-line: duplicate-set-field
vim.deprecate = function() end
vim.g.deprecation_warnings = false

-- Neovim 0.11+ features
if vim.fn.has("nvim-0.11") == 1 then
	vim.o.completeopt = "menuone,noselect,fuzzy"
	vim.o.winborder = "single"
end

-- Neovim 0.12+ features
if vim.fn.has("nvim-0.12") == 1 then
	vim.o.pummaxwidth = 100
	vim.o.completefuzzycollect = "keyword,files,whole_line"
end

-- Popup menu configuration
vim.o.pumheight = 10

-- Diagnostics (Neovim-only)
vim.diagnostic.config({
	virtual_text = true,
	update_in_insert = false,
})

-- Remove auto-commenting on new line (keep here so it overrides any plugin behavior)
vim.api.nvim_create_autocmd("BufWinEnter", {
	command = "set formatoptions-=cro",
})
