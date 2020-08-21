require('dotenv').config();
const moment = require('moment');
const mysql = require('mysql2');
const { get } = require('http');
const toUnnamed = require('named-placeholders')();

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

// testing collection queries

const {
    createCollection,
    getData,
    insertAccess
} = require('./collection')(pool,now);

function testCreateCollectionQuery(){
    createCollection(1,'some auth key','userId',123,'the token but hashed')
        .then(console.log)
        .catch(console.error);
}

function testGetDataQuery(){
    getData(1)
        .then(console.log)
        .catch(console.error);
}

function testInsertAccessQuery(){
    insertAccess(1,'ahmed')
        .then(console.log)
        .catch(console.error);
}



// testing queue queries

const {
    exists,
    incrementPosition,
    getPosition,
    insertEvent,
    getEventsAfterPosition
} = require('./queue')(pool,now);

function testExistsQuery(){
    exists('some queue name',1)
        .then(console.log)
        .catch(console.error);
}

function testIncrementPositionQuery(){
    incrementPosition('some queue name',1)
        .then(console.log)
        .catch(console.error);
}

function testGetPositionQuery(){
    getPosition('some queue name',1)
        .then(console.log)
        .catch(console.error);
}

function testInsertEventQuery(){
    const event= {
        data : JSON.stringify({"foo":"bar"}),
        position : 4,
        publishedAt : now(),
        requestHook : null
    }
    insertEvent(event,'some queue name')
        .then(console.log)
        .catch(console.error);
}

function testGetEventsAfterPositionQuery(){
    getEventsAfterPosition('some queue name',1,'ahmed',3)
        .then(console.log)
        .catch(console.error);
}
