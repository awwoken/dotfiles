-- TODO: Dedupe using source ~/.vimrc

vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.opt.termguicolors = true -- Enable 24-bit RGB color support

vim.opt.clipboard = "unnamedplus" -- Use the system clipboard for copy/paste
vim.opt.mouse = "" -- Disable mouse support

vim.opt.tabstop = 2 -- Set the number of spaces a tab represents
vim.opt.shiftwidth = 2 -- Spaces per indentation level
vim.opt.softtabstop = 2 -- Spaces inserted or deleted when pressing Tab or Backspace
vim.opt.hlsearch = true -- Highlight search results
vim.opt.autoindent = false -- Enable automatic indentation
vim.opt.incsearch = true -- Incremental search (highlight as you type)
vim.o.expandtab = true -- Expand tab input with spaces characters
-- vim.o.smartindent = true -- Syntax aware indentations for newline inserts

vim.opt.virtualedit = "block"
vim.opt.fillchars = { eob = " " } -- Use a space to fill the end of buffer
-- vim.opt.cursorlineopt = "number" -- Highlight the current line number
-- vim.opt.cursorline = true -- Highlight the current line
-- vim.opt.guicursor = "n-v-c-sm:block,i-ci-ve:block,r-cr-o:block" -- Always block cursor

vim.opt.cmdheight = 0 -- Set command line height to 0 (minimized)
vim.opt.laststatus = 0 -- Disable status line
-- vim.g.noshowmode = true -- Disable mode display in statusline
-- vim.o.showmode = false -- Disable mode indicator in the command line
vim.o.signcolumn = "yes" -- Always show the sign column

vim.opt.number = true -- Show line numbers
vim.opt.relativenumber = true -- Show relative line numbers

vim.opt.swapfile = false -- disable swap files
vim.opt.backup = false -- Disable backup files
vim.o.writebackup = false -- Don't store backup

vim.opt.scrolloff = 10
vim.opt.wrap = false -- Disable line wrapping
vim.opt.ignorecase = true -- Ignore case in searches
vim.opt.shortmess:append({ I = true }) -- Disable 'intro'
vim.o.pumheight = 10 -- Set height of popup menu

---@diagnostic disable-next-line: duplicate-set-field
vim.deprecate = function() end -- silent deprecation function
vim.g.deprecation_warnings = false -- Disable deprecation warnings

if vim.fn.has("nvim-0.11") == 1 then
	vim.o.completeopt = "menuone,noselect,fuzzy" -- Use fuzzy matching for built-in completion
	vim.o.winborder = "double" -- Use double-line as default border
end

if vim.fn.has("nvim-0.12") == 1 then
	vim.o.completeopt = "menuone,noselect,popup,fuzzy" -- Show LSP completion item previews
	vim.o.pummaxwidth = 40 -- Limit maximum width of popup menu
end

vim.api.nvim_create_autocmd("BufWinEnter", {
	command = "set formatoptions-=cro", -- Prevent new comments line
})

-- vim.o.spell = true -- Enable native spell check
-- vim.o.spelllang = "en,ru,uk" -- Define spelling dictionaries
-- vim.o.spelloptions = "camel" -- Treat parts of camelCase words as separate words

vim.diagnostic.config({
	virtual_text = true,
	update_in_insert = false,
})
