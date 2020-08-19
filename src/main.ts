/*import dependencies*/
const dotenv = require('dotenv');
const mysql = require('mysql2');
const toUnnamed = require('named-placeholders')();
const moment = require(`moment`);
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
    myExecute : (query:string, data : object)=> Promise<any>;
}

type event = {
    data : JSON;
    publishedAt : Date;
    position : number;
    id? : number
}
/*********************/



/**declare variables**/
let servicePool : DBPool;
let userPool : DBPool;
/*********************/



/***database setup***/
function promisifyPool(pool: DBPool):void{
    function execute(query : string , data : object):Promise<any>{
        const [unnamedQuery,dataArray] = toUnnamed(query,data);
        return new Promise<any>((resolve,reject)=>{
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

function setupServiceDBConnectionPool(mysql:{createPool:(config:object)=>DBPool}):void{
    servicePool = mysql.createPool({
        host     : process.env.DBHOST,
        user     : process.env.DBUSER,
        password : process.env.DBPASSWORD,
        database : process.env.SERVICEDB
    });

    promisifyPool(servicePool);
}

function setupUserDBConnectionPool(mysql:{createPool:(config:object)=>DBPool}):void{
    userPool = mysql.createPool({
        host     : process.env.DBHOST,
        user     : process.env.DBUSER,
        password : process.env.DBPASSWORD,
        database : process.env.USERDB
    });

    promisifyPool(userPool);
}
/******************/



class CollectionData{
    public id:number;
    private static pool:DBPool;

    constructor(id:number){
        this.id = id;
    }

    public getData():Promise<{authKey:string,userKey:string,expiration:number}>{
        const getDataQuery = "SELECT authKey , userKey, expiration FROM collection WHERE id = :id LIMIT 1;";

        return CollectionData.pool.myExecute(getDataQuery,{id : this.id})
            .then(result=>result[0]);
    }

    public static createCollection(id:string, authKey:string , userKey:string , expiration:number , hashedToken:string):Promise<any>{
        const createCollectionQuery = "INSERT INTO collection(id,authKey,userKey,expiration,hashedToken, createdAt, updatedAt) VALUES (:id,:authKey,:userKey,:expiration,:hashedToken,:now, :now);";

        return CollectionData.pool.myExecute(createCollectionQuery,{
            id,
            authKey,
            userKey,
            expiration,
            hashedToken,
            now : moment(Date.now()).format(`YYYY-MM-DD HH:mm:ss`)
        });
    }

    public static setDataBasePool(pool:DBPool):void{
        CollectionData.pool = pool;
    }
}



class Collection {
    public id:number;
    private collectionData:CollectionData;
    private static pool: DBPool;
    private eventTable = `t${this.id}event`;
    private eventUserTable = `t${this.id}eventUser`;
    private queueTable = `t${this.id}queue`;

    constructor(id:number) {
        this.id = id;
        this.collectionData = new CollectionData(id);
    }

    public getData():Promise<{authKey:string,userKey:string,expiration:number}>{
        return this.collectionData.getData();
    }

    public static setDataBasePool(pool:DBPool):void{
        Collection.pool = pool;
    }

    public static createCollection(id:string , authKey:string , userKey:string , expiration:number , hashedToken:string):Promise<any>{
        const eventTable = `t${id}event`;
        const eventUserTable = `t${id}eventUser`;
        const queueTable = `t${id}queue`;

        // TO-DO : insert more indexes
        const createEventTableQuery = `CREATE TABLE IF NOT EXISTS ${eventTable} (id INTEGER NOT NULL auto_increment UNIQUE ,data JSON NOT NULL, position INTEGER NOT NULL, publishedAt DATETIME NOT NULL, queue VARCHAR(255) NOT NULL ,PRIMARY KEY (id),FOREIGN KEY (queue) REFERENCES ${queueTable}(queue) ON DELETE CASCADE ON UPDATE CASCADE) ENGINE=InnoDB;`;
        const createEventUserTableQuery = `CREATE TABLE IF NOT EXISTS ${eventUserTable} (user VARCHAR(255) NOT NULL,event INTEGER NOT NULL,PRIMARY KEY (user,event) FOREIGN KEY (event) REFERENCES ${eventTable}(id) ON DELETE CASCADE ON UPDATE CASCADE) ENGINE=InnoDB;`;
        const createQueueTableQuery = `CREATE TABLE IF NOT EXISTS ${queueTable} (queue VARCHAR(255) NOT NULL UNIQUE,position INTEGER NOT NULL,PRIMARY KEY (queue))ENGINE=InnoDB;`;

        return CollectionData.createCollection(id,authKey,userKey,expiration,hashedToken)
            .then(()=>Collection.pool.myExecute(createQueueTableQuery,{}))
            .then(()=>Collection.pool.myExecute(createEventTableQuery,{}))
            .then(()=> Collection.pool.myExecute(createEventUserTableQuery,{}));
    }

    // TO-DO
    // public insertAccess(eventId:number,user:string):Promise<any>{
    //     const query = `INSERT INTO ${this.eventUserTable} `
    // }

    public Queue(){
        const collection = this;

        return class{
            public queueName:string;
        
            constructor(queueName:string){
                this.queueName = queueName;
            }
        
            public exists():Promise<boolean>{
                const queue = this.queueName;
                const query = `SELECT EXISTS( SELECT queue FROM ${collection.queueTable} WHERE queue = :queue LIMIT 1 ) AS exists;`;
                return Collection.pool.myExecute(query,{queue})
                    .then(result => result[0])
                    .then(data => data.exists);
            }

            public incrementPosition():Promise<any>{
                const queue = this.queueName;
                const query = `INSERT INTO ${collection.queueTable} (queue , position) VALUES (:queue,1) ON DUPLICATE KEY UPDATE position = position + 1;`;
                return Collection.pool.myExecute(query,{queue});
            }

            public getPosition():Promise<number>{
                const queue = this.queueName;
                const query = `SELECT position FROM ${collection.queueTable} WHERE queue = :queue LIMIT 1;`;
                return Collection.pool.myExecute(query,{queue})
                    .then(result=>result[0])
                    .then(data=>data.position);
            }
        }
    }
}



function main():void{
    dotenv.config();
    setupServiceDBConnectionPool(mysql);
    setupUserDBConnectionPool(mysql);
    CollectionData.setDataBasePool(servicePool);
    Collection.setDataBasePool(userPool);
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