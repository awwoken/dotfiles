return {
	"folke/snacks.nvim",
	lazy = false, -- `snacks.nvim` should not be lazy-loaded
	priority = 1000,
	opts = {
		bigfile = {
			-- leave it empty to use the default settings
		},

		statuscolumn = {
			-- leave it empty to use the default settings
		},

		explorer = {
			replace_netrw = true, -- Replace netrw with the snacks explorer
			trash = true, -- Use the system trash when deleting files
		},

		picker = {
			sources = {
				explorer = {
					layout = {
						auto_hide = { "input" },
						cycle = false,
					},
				},
			},
			icons = {
				diagnostics = {
					Error = "危", -- "danger" (kiken)
					Warn = "警", -- "warning" (keikai)
					Info = "情", -- "information" (jouhou)
					Hint = "助", -- "help/assistance" (tasuke)
				},
			},
		},

		image = {
			-- leave it empty to use the default settings
		},

		indent = {
			char = "▏",
			scope = {
				char = "▏",
			},
			animate = {
				enabled = false,
			},
		},

		lazygit = {
			-- leave it empty to use the default settings
		},

		words = {
			-- leave it empty to use the default settings
		},

		profile = {
			-- leave it empty to use the default settings
		},

		dashboard = {
			preset = {
				pick = nil, -- Defaults to a picker that supports `fzf-lua`, `telescope.nvim` and `mini.pick`
				keys = {
					{
						icon = " ",
						key = "f",
						desc = "Find File",
						action = ":lua require(\"snacks\").dashboard.pick('files')",
					},
					{ icon = " ", key = "n", desc = "New File", action = ":ene | startinsert" },
					{
						icon = " ",
						key = "g",
						desc = "Find Text",
						action = ":lua require(\"snacks\").dashboard.pick('live_grep')",
					},
					{
						icon = " ", -- Folder icon for Explorer
						key = "e",
						desc = "Explorer",
						action = function()
							-- Close the dashboard buffer
							vim.cmd("bd!")
							-- Open Snacks Explorer
							require("snacks").explorer()
						end,
					},
					{
						icon = " ",
						key = "c",
						desc = "Config",
						action = ":lua require(\"snacks\").dashboard.pick('files', {cwd = vim.fn.stdpath('config')})",
					},
					{
						icon = "󰒲 ",
						key = "L",
						desc = "Lazy",
						action = ":Lazy",
						enabled = package.loaded.lazy ~= nil,
					},
					{ icon = " ", key = "q", desc = "Quit", action = ":qa" },
				},
				header = table.concat({
					" ███╗   ██╗██╗   ██╗██╗███╗   ███╗",
					" ████╗  ██║██║   ██║██║████╗ ████║",
					" ██╔██╗ ██║██║   ██║██║██╔████╔██║",
					" ██║╚██╗██║╚██╗ ██╔╝██║██║╚██╔╝██║",
					" ██║ ╚████║ ╚████╔╝ ██║██║ ╚═╝ ██║",
					" ╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚═╝     ╚═╝",
				}, "\n"),
			},
		},
	},

	init = function()
		-- quite nvim if file tree is the last window
		vim.api.nvim_create_autocmd("QuitPre", {
			callback = function()
				local snacks_windows = {}
				local floating_windows = {}

				local windows = vim.api.nvim_list_wins()

				for _, w in ipairs(windows) do
					local filetype = vim.api.nvim_get_option_value("filetype", { buf = vim.api.nvim_win_get_buf(w) })
					if filetype:match("snacks_") ~= nil then
						table.insert(snacks_windows, w)
					elseif vim.api.nvim_win_get_config(w).relative ~= "" then
						table.insert(floating_windows, w)
					end
				end

				if
					1 == #windows - #floating_windows - #snacks_windows
					and vim.api.nvim_win_get_config(vim.api.nvim_get_current_win()).relative == ""
				then
					-- Should quit, so we close all Snacks windows.
					for _, w in ipairs(snacks_windows) do
						vim.api.nvim_win_close(w, true)
					end
				end
			end,
		})
	end,

	keys = {
		-- explorer (focus if exists)
		{
			"<leader>e",
			function()
				local explorer_win = nil

				for _, win in ipairs(vim.api.nvim_list_wins()) do
					local buf = vim.api.nvim_win_get_buf(win)
					local ft = vim.bo[buf].filetype
					if ft == "snacks_picker_list" then
						explorer_win = win
						break
					end
				end

				if vim.api.nvim_get_current_win() ~= explorer_win and explorer_win then
					vim.api.nvim_set_current_win(explorer_win)
				else
					require("snacks").explorer()
				end
			end,
			desc = "Snacks File Explorer",
		},

		-- lazygit
		{
			"<leader>lg",
			function()
				require("snacks").lazygit()
			end,
			desc = "Snacks LazyGit",
		},

		-- Top Pickers & Explorer
		{
			"<leader><space>",
			function()
				require("snacks").picker.smart()
			end,
			desc = "Smart Find Files",
		},
		{
			"<leader>fg",
			function()
				require("snacks").picker.grep()
			end,
			desc = "Grep",
		},
		{
			"<leader>ff",
			function()
				require("snacks").picker.files()
			end,
			desc = "Find Files",
		},
		-- -- gh
		-- {
		-- 	"<leader>gi",
		-- 	function()
		-- 		require("snacks").picker.gh_issue()
		-- 	end,
		-- 	desc = "GitHub Issues (open)",
		-- },
		-- {
		-- 	"<leader>gI",
		-- 	function()
		-- 		require("snacks").picker.gh_issue({ state = "all" })
		-- 	end,
		-- 	desc = "GitHub Issues (all)",
		-- },
		-- {
		-- 	"<leader>gp",
		-- 	function()
		-- 		require("snacks").picker.gh_pr()
		-- 	end,
		-- 	desc = "GitHub Pull Requests (open)",
		-- },
		-- {
		-- 	"<leader>gP",
		-- 	function()
		-- 		require("snacks").picker.gh_pr({ state = "all" })
		-- 	end,
		-- 	desc = "GitHub Pull Requests (all)",
		-- },
		{
			"<leader>fD",
			function()
				require("snacks").picker.diagnostics_buffer()
			end,
			desc = "Buffer Diagnostics",
		},
		-- LSP
		{
			"gd",
			function()
				require("snacks").picker.lsp_definitions()
			end,
			desc = "Goto Definition",
		},
		{
			"gr",
			function()
				require("snacks").picker.lsp_references()
			end,
			nowait = true,
			desc = "References",
		},
		{
			"gt",
			function()
				require("snacks").picker.lsp_type_definitions()
			end,
			desc = "Goto Type Definition",
		},
	},
}
