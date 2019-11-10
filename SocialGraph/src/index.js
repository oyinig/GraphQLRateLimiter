const { prisma } = require("./../generated/prisma-client")
const {forwardTo} = require("prisma-binding")
const { ApolloServer, gql } = require("apollo-server");





const typeDefs = gql `
type User {
  id: ID
  name: String
  age: Int
  email: String
  posts: [Post]
  follows: [User]  
  followers: [User]  
}

type Post {
  id: ID!
  title: String!
  published: Boolean!
  author: User!
}

type Config {
  id: ID! 
  IP: String!  @unique 
  AllowedCallPerMinute: Int! 
}


type Calls {
    id: ID! 
    IP: String!
    Endpoint: String!
    TimeStamp: Int! 
  }


    
type Query{
    getUserByEmailThrottled(reqEmail:String):User
	getUsersFollowersThrottled(reqEmail:String):User
    getUserFollowingThrottled(reqEmail:String):User
    getconfig(reqIP:String):Config
     
}
scalar DateTime
type Mutation{

    createConfig( IP: String!, AllowedCallPerMinute: Int! ):Config
    createCustomUsers(name: String!, age: Int, email: String!):User
   
}
`

const resolvers ={
    Query:{
         getUserByEmailThrottled : async (parent, {reqEmail}, context) =>{
             
            var IP = context.ip
            var  Endpoint = "getUserByEmailThrottled"
            var TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
            if(context.db ){
                await context.db.createCalls({ IP , Endpoint, TimeStamp  })  
                return await context.db.user({email: reqEmail} )
            }
        },

        getconfig : async (parent, {reqIP}, context) =>{
             
            var IP = context.ip
            var  Endpoint = "getconfig"
            var TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
            if(context.db ){
                await context.db.createCalls({ IP , Endpoint, TimeStamp  })  
                return await context.db.configs({where: {IP: reqIP}})
            }
        },
       

        
    },

    Mutation :{
        createConfig : async(parent, { IP, AllowedCallPerMinute }, context) => {
            var IP = context.ip
            var Endpoint = "createConfig"
            var TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
            if(context.db){
                await context.db.createCalls({ IP , Endpoint, TimeStamp  }) 
                return context.db.createConfig({ IP, AllowedCallPerMinute })
            }
        },

        createCustomUsers: async(parent, {name, age, email}, context) => {
            var IP = context.ip
            var Endpoint = "createCustomUsers"
            var TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
            if(context.db){
                await context.db.createCalls({ IP , Endpoint, TimeStamp  }) 
                return await context.db.createUser({name, age, email})
            }
        },
        
 
    }
}



const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    
    context: async ({ req, res }) => {
        const headers = req.headers
        const ip = req.ip 
        const db = prisma
        const responseHeader = res 
        const TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
        const pastSeconds = parseInt(new Date().getSeconds()); //Just to make sure it ends up as an integer
        const timeToRollOver = TimeStamp+(60-pastSeconds)
        const resetTime = new Date(timeToRollOver*1000)
        console.log(TimeStamp - pastSeconds, TimeStamp, pastSeconds)
        const aggrCount = await db.callsesConnection({ where: {
            AND: [{
                TimeStamp_gte: TimeStamp - pastSeconds
            }, {
                TimeStamp_lte: TimeStamp
            }] }}).aggregate().count()
        const AvailableCalls = await db.configs({where: {IP: req.ip } });
        console.log("AvailableCalls", AvailableCalls[0].AllowedCallPerMinute);
        const callsLeft  = AvailableCalls[0].AllowedCallPerMinute - aggrCount;
        if (callsLeft <= 0 ) {
            res.setHeader('Callsleft', '0');
            res.setHeader('ResetTime', resetTime);
            return {};
        }else{
            res.setHeader('Callsleft', callsLeft);
            res.setHeader('ResetTime', resetTime);

        }
        console.log("Used Calls: ", aggrCount,"Available Calls: ", callsLeft, "Reset Time: ",  resetTime, "TimeToReset: ",
        timeToRollOver, "Seconds Spent", pastSeconds, "CurrentTimeStamp", TimeStamp);

        //console.log(responseHeader);
        return {
          headers,
          ip,
          responseHeader,
          db, // the generated prisma client if you are using it
        }
      },
    playground: true
});

server.listen().then(({ url }) => {
    console.log(`Server ready at ${url}`);
  });
 
 
