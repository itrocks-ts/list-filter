const { File }           = require('@itrocks/class-file')
const { Representative } = require('@itrocks/class-view')

class Director {}

File(__filename)(Director)
Representative('lastName', 'firstName')(Director)

module.exports = { Director }
