let mapleader = " "
let maplocalleader = " "

" Make normal background transparent
hi Normal guibg=NONE ctermbg=NONE
hi SignColumn guibg=NONE ctermbg=NONE
hi CursorLine guibg=NONE ctermbg=NONE

" 24-bit colors
if has("termguicolors")
  set termguicolors
endif

" System clipboard
set clipboard=unnamed

" Disable mouse
set mouse=

" Indentation options
set tabstop=2
set shiftwidth=2
set expandtab
set autoindent
set smartindent

" Search behavior
set hlsearch
set incsearch
set ignorecase

" Disable mode display
set noshowmode

" Always show sign column
set signcolumn=yes

" Line numbering
set number
set relativenumber

" No swap/backup files
set noswapfile
set nobackup
set nowritebackup

" Scroll offset + no wrapping
set scrolloff=10
set nowrap

" Shortmess append
set shortmess+=I

" Popup menu height
set pumheight=10

" Remove automatic comment continuation
autocmd BufWinEnter * setlocal formatoptions-=cro

