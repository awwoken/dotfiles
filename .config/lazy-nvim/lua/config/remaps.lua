local map = function(mode, lhs, rhs)
	vim.keymap.set(mode, lhs, rhs, { silent = true, nowait = true })
end

-- Save on Space + W
map("n", "<leader>w", ":silent write<CR>")

-- Keep search in the center
map("n", "n", "nzzzv")
map("n", "N", "Nzzzv")

-- Center cursor on C-d and C-u
map("n", "<C-d>", "<C-d>zz")
map("n", "<C-u>", "<C-u>zz")

-- LSP bindings
map("n", "<leader>d", vim.lsp.buf.hover)
map("n", "<leader>D", vim.diagnostic.open_float)
map("n", "<leader>ca", vim.lsp.buf.code_action)
map("n", "<leader>rn", vim.lsp.buf.rename)
