require('mysql2/node_modules/iconv-lite').encodingExists('foo')
const {
    testDBSetup
} = require('../src/main');

test('testing data base set up',testDBSetup);