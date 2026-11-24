const { File } = require('@itrocks/class-file')

class Film {}
class Studio {}

File(__filename)(Film)
File(__filename)(Studio)

module.exports = { Film, Studio }
