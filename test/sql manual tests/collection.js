module.exports = (pool,now) =>{
    return {
        createCollection(id,authKey,userKey,expiration,hashedToken){
            const query = "INSERT INTO collections(id,authKey,userKey,expiration,hashedToken, createdAt, updatedAt) VALUES (:id,:authKey,:userKey,:expiration,:hashedToken,:now, :now);";
        
            return pool.myExecute(query,{
                id,
                authKey,
                userKey,
                expiration,
                hashedToken,
                now : now()
            });
        },
        getData(id){
            const query = "SELECT authKey , userKey, expiration FROM collections WHERE id = :id LIMIT 1;";

            return pool.myExecute(query,{id})
            .then(result => result[0]);
        },
        insertAccess(eventId,user){
            const query = "INSERT INTO accesses (user , event) VALUES (:user , :event);";

            return pool.myExecute(query,{
                user,
                event : eventId
            });
        }
    }
}