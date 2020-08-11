# OneDrive Direct Link

Generate direct download link from an OneDrive public share.  

## Usage

Backend access point is at:

`/?share=url`

`/?embed=url`

share link url should point to single file, and should be public available (no permission required, no password required).

## Todos

1. Generate short link, store it into memory and local files. Everytime server starts, read the dictionary from local files and make changes to the memory and local file on the go.  
2. Simple front-end page for url input and short link generation.
