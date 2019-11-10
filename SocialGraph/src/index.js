const { prisma } = require("./../generated/prisma-client")
const {forwardTo} = require("prisma-binding")
const { ApolloServer, gql } = require("apollo-server");
const ipaddr = require('ipaddr.js');




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
  IP: String!
  AllowedCallPerMinute: Int! 
}


type Calls {
    id: ID! 
    IP: String!
    Endpoint: String!
    TimeStamp: Int! 
  }


   
type Query{
    getUserByEmailThrottled(reqEmail:String):User!
	getUsersFollowersThrottled(reqEmail:String):User
	getUserFollowingThrottled(reqEmail:String):User
     
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
        
            const IP = context.ip
            const Endpoint = "getUserByEmailThrottled"
            const TimeStamp = parseInt(Date.now()/1000) // Converts millisecond to seconds
            const pastSeconds = parseInt(new Date().getSeconds()); //Just to make sure it ends up as an integer
            const timeToRollOver = TimeStamp+(60-pastSeconds)
            const resetTime = new Date(timeToRollOver*1000)

            const aggrCount = await context.db.callsesConnection({ where: {
                AND: [{
                    TimeStamp_gte: TimeStamp - pastSeconds
                }, {
                    TimeStamp_lte: TimeStamp
                }] }}).aggregate().count()
 
                    const callsLeft  = 100 - aggrCount;
                    if (callsLeft <= 0 ) {
                        context.responseHeader.setHeader('Callsleft', '0');
                        context.responseHeader.setHeader('ResetTime', resetTime);
                        return {};
                    }else{
                        context.responseHeader.setHeader('Callsleft', callsLeft);
                        context.responseHeader.setHeader('ResetTime', resetTime);

                    }
                    console.log("Used Calls: ", aggrCount,"Available Calls: ", callsLeft, "Reset Time: ",  resetTime, "TimeToReset: ",
                    timeToRollOver, "Seconds Spent", pastSeconds, "CurrentTimeStamp", TimeStamp);
  
            await context.db.createCalls({ IP , Endpoint, TimeStamp  }) 
            //console.log(await context.db.user( {email: reqEmail} ))
            return await context.db.user({email: reqEmail} )
        },
       

        
    },

    Mutation :{
        createConfig :(parent, { IP, AllowedCallPerMinute }, context) => {
            
            return context.db.createConfig({ IP, AllowedCallPerMinute })
        },

        createCustomUsers: (parent, {name, age, email}, context) => {
            return context.db.createUser({name, age, email})
        },
        
 
    }
}



const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    
    context: ({ req, res }) => {
        const headers = req.headers
        const ip = req.ip 
        const db = prisma
        const responseHeader = res
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
 
 
