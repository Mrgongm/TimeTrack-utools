const fs = require('node:fs')
const path = require('node:path')

window.services = {
  exportJson (text, filename) {
    const downloads = window.utools.getPath('downloads')
    const filePath = path.join(downloads, filename || `timetrack-export-${Date.now()}.json`)
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  }
}
