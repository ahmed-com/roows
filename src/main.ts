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
    requestHook : string | null;
    id? : number
}
/*********************/



/***database setup***/
function promisifyPool(pool: DBPool):DBPool{
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
    return pool;
}

function setupDBConnectionPool(mysql:{createPool:(config:object)=>DBPool}):DBPool{
    const pool = mysql.createPool({
        host     : process.env.DBHOST,
        user     : process.env.DBUSER,
        password : process.env.DBPASSWORD,
        database : process.env.SERVICEDB
    });

    return promisifyPool(pool);
}
/******************/



class Collection {
    public id:number;
    private static pool: DBPool;

    constructor(id:number) {
        this.id = id;
    }

    public getData():Promise<{authKey:string,userKey:string,expiration:number}>{
        const id = this.id;
        const query = "SELECT authKey , userKey, expiration FROM collection WHERE id = :id LIMIT 1;";

        return Collection.pool.myExecute(query,{id})
            .then(result => result[0]);
    }

    public static setDataBasePool(pool:DBPool):void{
        Collection.pool = pool;
    }

    public static createCollection(id:string , authKey:string , userKey:string , expiration:number , hashedToken:string):Promise<any>{
        const query = "INSERT INTO collection(id,authKey,userKey,expiration,hashedToken, createdAt, updatedAt) VALUES (:id,:authKey,:userKey,:expiration,:hashedToken,:now, :now);";

        return Collection.pool.myExecute(query,{
            id,
            authKey,
            userKey,
            expiration,
            hashedToken,
            now : moment(Date.now()).format(`YYYY-MM-DD HH:mm:ss`)
        });
    }

    public insertAccess(eventId:number,user:string):Promise<any>{
        const query = "INSERT INTO accesses (user , event) VALUES (:user , :event);";

        return Collection.pool.myExecute(query,{
            user,
            event : eventId
        });
    }

}



class Queue{
    public collection:Collection;
    public queueName:string;
    private static pool: DBPool;

    constructor(queueName:string , collection:Collection){
        this.queueName = queueName;
        this.collection = collection;
    }

    public static setDataBasePool(pool:DBPool):void{
        Queue.pool = pool;
    }

    public exists():Promise<boolean>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "SELECT EXISTS( SELECT queue FROM queues WHERE queue = :queue AND collection = :collection LIMIT 1 ) AS exists;";
        return Queue.pool.myExecute(query,{
            queue,
            collection
        })
        .then(result => result[0])
        .then(data => data.exists);
    }

    public incrementPosition():Promise<any>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "INSERT INTO queues (queue , position, collection) VALUES (:queue,1,:collection) ON DUPLICATE KEY UPDATE position = position + 1;";
        return Queue.pool.myExecute(query,{
            queue,
            collection
        });
    }

    public getPosition():Promise<number>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "SELECT position FROM queues WHERE queue = :queue AND collection = :collection LIMIT 1;";
        return Queue.pool.myExecute(query,{
            queue,
            collection
        })
        .then(result=>result[0])
        .then(data=>data.position);
    }

    public insertEvent(event:event):Promise<number>{
        const queue = this.queueName;
        const query = "INSERT INTO events (data,position,publishedAt,queue, requestHook) VALUES (:data , :position , :publishedAt ,:queue,:requestHook);";

        return Queue.pool.myExecute(query,{
            queue,
            ...event
        })
        .then(({insertId})=>insertId);
    }

    public getEventsAfterPosition(position:number, user:string):Promise<event[]>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "SELECT events.data AS data , events.publishedAt AS publishedAt , events.position AS position , events.requestHook AS requestHook , events.id AS id FROM events INNER JOIN accesses ON events.id = accesses.event INNER JOIN queues ON events.queue = queues.queue WHERE accesses.user = :user AND queues.queue = :queue AND queues.collection = :collection AND events.position > :position;";

        return Queue.pool.myExecute(query,{
            user,
            queue,
            collection,
            position
        })
    }
}



function main():void{
    dotenv.config();
    const pool:DBPool = setupDBConnectionPool(mysql);
    Collection.setDataBasePool(pool);
}



function runGarbageCollectors():void{

}



/**testing setup**/
// const testDataBaseSetup = function():void{
//     testSetup(pool);

//     function testSetup(pool:DBPool):void{
//         const query = `INSERT INTO tabletest(fieldtest) VALUES (:value);`;
//         pool.myExecute(query,{value : 1})
//     }
// }
/*****************/
// module.exports = {
//     testDBSetup : testDataBaseSetup
// }