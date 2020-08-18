/*import dependencies*/
const dotenv = require('dotenv');
const mysql = require('mysql2');
const toUnnamed = require('named-placeholders')();
/*********************/



/***run the service***/
main();
runGarbageCollectors();
/*********************/



/****declare types****/
type mysqlCallback = (err:any , rows:Object[])=>void;
type basic = string|number|boolean|Date;

interface DBPool{
    execute : (query:string, data : basic[], callback:mysqlCallback)=> void;
    myExecute : (query:string, data : object)=> Promise<object[]>;
}
/*********************/



/**declare variables**/
let servicePool : DBPool;
let userPool : DBPool;
/*********************/



function promisifyPool(pool: DBPool):void{
    function execute(query : string , data : object):Promise<Object[]>{
        const [unnamedQuery,dataArray] = toUnnamed(query,data);
        return new Promise<object[]>((resolve,reject)=>{
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
}

function setupServiceDBConnectionPool():void{
    servicePool = mysql.createPool({
        host     : process.env.DBHOST,
        user     : process.env.DBUSER,
        password : process.env.DBPASSWORD,
        database : process.env.SERVICEDB
    });

    promisifyPool(servicePool);
}

function setupUserDBConnectionPool():void{
    userPool = mysql.createPool({
        host     : process.env.DBHOST,
        user     : process.env.DBUSER,
        password : process.env.DBPASSWORD,
        database : process.env.USERDB
    });

    promisifyPool(userPool);
}

function main():void{
    dotenv.config();
    setupServiceDBConnectionPool();
    setupUserDBConnectionPool();

}

function runGarbageCollectors():void{

}
/**testing setup**/
const testDataBaseSetup = function():void{
    testSetup(userPool);
    testSetup(servicePool);

    function testSetup(pool:DBPool):void{
        const query = `INSERT INTO tabletest(fieldtest) VALUES (:value);`;
        pool.myExecute(query,{value : 1})
    }
}
/*****************/
module.exports = {
    testDBSetup : testDataBaseSetup
}