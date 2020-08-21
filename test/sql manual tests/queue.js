module.exports = (pool,now)=>{
    return {
        exists(queue,collection){
            const query = "SELECT EXISTS( SELECT queue FROM queues WHERE queue = :queue AND collection = :collection LIMIT 1 ) AS bool;";
            return pool.myExecute(query,{
                queue,
                collection
            })
            .then(result => result[0])
            .then(data=>data.bool);
        },
        incrementPosition(queue,collection){
            const query = "INSERT INTO queues (queue , lastPosition, collection) VALUES (:queue,1,:collection) ON DUPLICATE KEY UPDATE lastPosition = lastPosition + 1;";
            return pool.myExecute(query,{
                queue,
                collection
            });
        },
        getPosition(queue,collection){
            const query = "SELECT lastPosition FROM queues WHERE queue = :queue AND collection = :collection LIMIT 1;";
            return pool.myExecute(query,{
                queue,
                collection
            })
            .then(result=>result[0])
            .then(data=>data.lastPosition);
        },
        insertEvent(event,queue){
            const query = "INSERT INTO events (data,position,publishedAt,queue, requestHook) VALUES (:data , :position , :publishedAt ,:queue,:requestHook);";

            return pool.myExecute(query,{
                queue,
                ...event
            })
            .then(({insertId})=>insertId);
        },
        getEventsAfterPosition(queue,collection,user,position){
            const query = "SELECT events.data AS data , events.publishedAt AS publishedAt , events.position AS position , events.requestHook AS requestHook , events.id AS id FROM events INNER JOIN accesses ON events.id = accesses.event INNER JOIN queues ON events.queue = queues.queue WHERE accesses.user = :user AND queues.queue = :queue AND queues.collection = :collection AND events.position > :position;";

            return pool.myExecute(query,{
                user,
                queue,
                collection,
                position
            });
        }
    }
}