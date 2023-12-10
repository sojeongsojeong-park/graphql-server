const { createClient } = require("@supabase/supabase-js");
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { InMemoryLRUCache } = require("@apollo/utils.keyvaluecache");
const responseCachePlugin = require("@apollo/server-plugin-response-cache");
const dotenv = require("dotenv");

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const typeDefs = `#graphql

enum CacheControlScope {
  PUBLIC
  PRIVATE
}

directive @cacheControl (
  maxAge: Int
  scope: CacheControlScope
) on FIELD_DEFINITION | OBJECT | INTERFACE

input filterMemberQueryInput {
  no:String
  name: String
  gender: String
  birthday: String
  roleId: String
  profileImg: String
  jobStartYear: String
  jobTitleId:String
  joinedYear: String
  jobTitle: String
  }

input registerMemberMutationInput {
  no:String!
  name: String!
  gender: String!
  birthday: String!
  roleId: String!
  profileImg: String
  jobStartYear: String!
  jobTitleId:String!
  joinedYear: String!
  jobTitle: String!
  }

  type Role {
  id: Int
  name: String
  }

  type JobTitle {
    id: Int
    name: String
  }

  type Member {
    no: String
    name: String
    role: Role @cacheControl(maxAge:600)
    profileImg: String
    gender: String
    birthday: String
    jobStartYear: String
    joinedYear: String
    jobTitle: JobTitle @cacheControl(maxAge:600)
    
  }

  type MutationResult {
    isSuccess: Boolean
  }

  type Query {
    members: [Member] @cacheControl(maxAge:600)
    filteredMembers(filteredMemberInfo:filterMemberQueryInput):[Member]
  }
  
  type Mutation {
    registerMember(registerInfo:registerMemberMutationInput): MutationResult
  }
`;

const resolvers = {
  Query: {
    members: async (_parent, _args, _context, info) => {
      const { data: members, error: membersError } = await supabase
        .from("Member")
        .select("*");

      console.log("membvers", membersError);
      return members;
    },
    filteredMembers: async (_parent, args, _context, info) => {
      const { data: members, error: membersError } = await supabase
        .from("Member")
        .select("*");

      console.log("error", membersError);

      const filterInfo = args.filteredMemberInfo;

      let result = members;

      const filterFn = (key, value) => {
        result = result.filter((member) => member[`${key}`] === value);
      };

      for (const key in filterInfo) {
        console.log(key, filterInfo[key], result);
        filterFn(key, filterInfo[key]);
      }

      return result;
    },
  },
  Member: {
    role: async (parent, _args, _context, info) => {
      const { data: roles, error: rolesError } = await supabase
        .from("Role")
        .select("*");

      console.log("cache?!");

      return roles.find((role) => role.id === parent.roleId);
    },
    jobTitle: async (parent) => {
      const { data: jobTitles, error: jobTitlesError } = await supabase
        .from("JobTitle")
        .select("*");

      return jobTitles.find((jobTitle) => jobTitle.id === parent.jobTitleId);
    },
  },
  Mutation: {
    registerMember: async (_parent, args) => {
      try {
        const input = args.registerInfo;
        const { data, error } = await supabase
          .from("Member")
          .insert([
            {
              no: input.no,
              name: input.name,
              gender: input.gender,
              birthday: input.birthday,
              roleId: input.roleId,
              profileImg:
                input.profileImg ??
                "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
              jobStartYear: input.jobStartYear,
              jobTitleId: input.jobTitle,
            },
          ])
          .select();
        return data.length > 0 ? { isSuccess: true } : { isSuccess: false };
      } catch (e) {
        console.error(e);
      }
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    responseCachePlugin.default({
      maxAge: 600,
    }),
  ],
});

(async () => {
  try {
    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
      context: ({ req }) => {
        // console.log(req.headers);
      },
    });
    console.log(`🚀  Server ready at: ${url}`);
  } catch (e) {
    console.log(e);
  }
})();
