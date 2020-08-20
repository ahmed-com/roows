require('dotenv').config();
const moment = require('moment');
const mysql = require('mysql2');
const toUnnamed = require('named-placeholders');

const pool = mysql.createPool({
    host     : process.env.DBHOST,
    user     : process.env.DBUSER,
    password : process.env.DBPASSWORD,
    database : process.env.TESTDB,
    multipleStatements: true
});

const execute = (query,data)=>{
    const [unnamedQuery,dataArray] = toUnnamed(query,data);
    return new Promise((resolve,reject)=>{
        pool.execute(unnamedQuery, dataArray,(err, rows)=>{
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    })
}

pool.myExecute = execute;

const now = ()=> moment(Date.now()).format(`YYYY-MM-DD HH:mm:ss`);

/**************************************************************************************************************************************************/

// import queries here for testing.