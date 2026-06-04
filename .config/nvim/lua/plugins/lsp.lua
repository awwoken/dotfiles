vim.pack.add({
	{ src = "https://github.com/williamboman/mason.nvim" },
	{ src = "https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim" },
	{ src = "https://github.com/neovim/nvim-lspconfig" },
}, { confirm = false })

vim.schedule(function()
	local MiniExtra = require("mini.extra")
	local Mason = require("mason")

	MiniExtra.setup()

	Mason.setup({
		ui = {
			icons = {
				package_installed = "[x]",
				package_pending = "[?]",
				package_uninstalled = "[]",
			},
		},
	})

	local MasonToolInstaller = require("mason-tool-installer")

	MasonToolInstaller.setup({
		ensure_installed = {
			"stylua",
			"prettierd",
			"css-lsp",
			"html-lsp",
			"tailwindcss-language-server",
			"typescript-language-server",
			"lua-language-server",
			"json-lsp",
			"prisma-language-server",
			"shfmt",
			"clangd",
			"eslint-lsp",
			"oxlint",
			"rust-analyzer",
			"taplo",
		},
		auto_update = true,
	})

	vim.lsp.config("*", {
		capabilities = require("blink.cmp").get_lsp_capabilities(),
	})

	vim.lsp.config("ts_ls", { -- prioritize git marker to share one lsp through monorepo
		root_markers = { ".git", "tsconfig.json", "jsconfig.json", "package.json" },
	})

	vim.lsp.config("eslint", { -- pick correct configuration file in monorepo
		settings = {
			workingDirectory = { mode = "location" },
		},
	})

	vim.lsp.config("oxlint", {
		root_dir = function(bufnr, on_dir)
			local root = vim.fs.root(bufnr, {
				{ ".oxlintrc.json", ".oxlintrc.jsonc", "oxlint.config.ts" },
				function(name, path)
					if name ~= "package.json" then
						return false
					end

					local ok, lines = pcall(vim.fn.readfile, vim.fs.joinpath(path, name))
					local content = ok and table.concat(lines, "\n") or ""

					return content:find('"oxlint"', 1, true) or content:find('"vite-plus"', 1, true)
				end,
			})

			if root then
				on_dir(root)
			end
		end,
		settings = {
			run = "onType",
		},
	})

	vim.lsp.config("clangd", {
		cmd = { "clangd", "--pretty", "--background-index", "--clang-tidy", "--log=verbose" },
	})

	vim.lsp.config("lua_ls", {
		settings = {
			Lua = {
				runtime = { version = "LuaJIT" },
				workspace = {
					checkThirdParty = false,
					library = { vim.env.VIMRUNTIME },
				},
				telemetry = { enable = false },
			},
		},
	})

	local extraMap = function(lhs, rhs, buf)
		vim.keymap.set("n", lhs, rhs, { buffer = buf, silent = true, nowait = true })
	end

	vim.api.nvim_create_autocmd("LspAttach", {
		callback = function(args)
			extraMap("gd", function()
				MiniExtra.pickers.lsp({ scope = "definition" })
			end, args.buf)
			extraMap("gr", function()
				MiniExtra.pickers.lsp({ scope = "references" })
			end, args.buf)
			extraMap("gt", function()
				MiniExtra.pickers.lsp({ scope = "type_definition" })
			end, args.buf)
		end,
		group = vim.api.nvim_create_augroup("UserLspConfig", {}),
	})

	vim.lsp.enable({
		"lua_ls",
		"ts_ls",
		"tailwindcss",
		"cssls",
		"html",
		"jsonls",
		"prismals",
		"clangd",
		"rust_analyzer",
		"eslint",
		"oxlint",
	})
end)
