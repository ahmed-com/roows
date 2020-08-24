/*import dependencies*/
import dotenv from 'dotenv';
import ws from 'ws';
const mysql = require('mysql2');
const toUnnamed = require('named-placeholders')();
import moment, { fn } from 'moment';
import express,{Request,Response,NextFunction} from 'express';
import {json} from 'body-parser';
/*********************/



/****import files****/
import generalApiRouter from './routes/general-api';
import collectionApiRouter from './routes/collection-api';
import { Socket } from 'dgram';
import { IncomingMessage } from 'http';
/*********************/



/****declare types****/
type mysqlCallback = (err:any , rows:Object[])=>void;

type basic = string|number|boolean|Date;

interface DBPool{
    execute : (query:string, data : basic[], callback:mysqlCallback)=> void;
    myExecute : (query:string, data : object)=> Promise<any>;
}

interface connections{
    [user:string] : [Socket]
}

type event = {
    data : JSON;
    publishedAt : Date;
    position : number;
    requestHook : string | null;
    id? : number
}
/*********************/



/**declare variables**/
let DBHost:string;
let DBUser:string;
let DBPassword:string;
let serviceDB:string;
let httpPort:number;
let wsPort:number;
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
        host     : DBHost,
        user     : DBUser,
        password : DBPassword,
        database : serviceDB
    });

    return promisifyPool(pool);
}
/******************/



class Collection {
    public id:number;
    private connections:connections;
    private static pool: DBPool;

    constructor(id:number) {
        this.id = id;
        this.connections = {};
    }

    public addConnection(user:string,socket:Socket):void{
        // TO-DO
    }

    public removeConnection(user:string,socket:Socket):void{
        // TO-DO
    }

    public getData():Promise<{authKey:string,userKey:string,expiration:number}>{
        const id = this.id;
        const query = "SELECT authKey , userKey, expiration FROM collections WHERE id = :id LIMIT 1;";

        return Collection.pool.myExecute(query,{id})
            .then(result => result[0]);
    }

    public static setDataBasePool(pool:DBPool):void{
        Collection.pool = pool;
    }

    public static createCollection(id:string , authKey:string , userKey:string , expiration:number , hashedToken:string):Promise<any>{
        const query = "INSERT INTO collections(id,authKey,userKey,expiration,hashedToken, createdAt, updatedAt) VALUES (:id,:authKey,:userKey,:expiration,:hashedToken,:now, :now);";

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

    public insertDeliverdAccess(eventId:number,user:string):Promise<any>{
        const query = "INSERT INTO accesses (user , event,deliverd) VALUES (:user , :event,1);";

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
        .then(data => data.bool);
    }

    public incrementPosition():Promise<any>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "INSERT INTO queues (queue , lastPosition, collection) VALUES (:queue,1,:collection) ON DUPLICATE KEY UPDATE lastPosition = lastPosition + 1;";
        return Queue.pool.myExecute(query,{
            queue,
            collection
        });
    }

    public getPosition():Promise<number>{
        const queue = this.queueName;
        const collection = this.collection.id;
        const query = "SELECT lastPosition FROM queues WHERE queue = :queue AND collection = :collection LIMIT 1;";
        return Queue.pool.myExecute(query,{
            queue,
            collection
        })
        .then(result=>result[0])
        .then(data=>data.lastPosition);
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
        });
    }

    public getListeners():Promise<string[]>{
        // TO-DO
    }

    public addListener(user:string):Promise<any>{
        // TO-DO
    }

    public removeListener(user:string):Promise<any>{
        // TO-DO
    }
}

function importConstants():void{
    DBHost = process.env.DBHOST || 'localhost';
    DBUser = process.env.DBUSER || 'root';
    DBPassword = process.env.DBPASSWORD || '';
    serviceDB = process.env.SERVICEDB || 'roows';
    httpPort = parseInt(process.env.HTTPPORT || '5000');
    wsPort = parseInt(process.env.WSPORT || '4999');
}



function handleConnction(socket:ws,request:IncomingMessage):void{
    // TO-DO :
    // get the collection ID from request.headers.host
    // get the client token from request.headers['sec-websocket-protocol']
    // if authentication is successful : store the socket in that collection connections
    
    // socket.on('close', TO-DO );
}



function main():void{
    dotenv.config();
    importConstants();

    const pool:DBPool = setupDBConnectionPool(mysql);
    Collection.setDataBasePool(pool);

    const app = express();

    app.use(json());
    app.use('/',generalApiRouter);
    app.use(function errorHandler(err:Error,req:Request,res:Response,next:NextFunction):void{
        res.status(500).json({message : err.message});
    });


    app.listen(httpPort);

    const webSocketServer = new ws.Server({port : wsPort});
    webSocketServer.on('connection',handleConnction);
}



function runGarbageCollectors():void{

}




/***run the service***/
main();
runGarbageCollectors();
/*********************/





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