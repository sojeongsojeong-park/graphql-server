const { createClient } = require("@supabase/supabase-js");
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { InMemoryLRUCache } = require("@apollo/utils.keyvaluecache");
const responseCachePlugin = require("@apollo/server-plugin-response-cache");
require("dotenv").config();

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

  type Role {
  id: Int
  name: String
  }

  type JobGrade {
    id: Int
    name: String
  }

  type Member{
    no: String
    name: String
    role: Role @cacheControl(maxAge:600)
    profileImg: String
    gender: String
    birthday: String
    jobStartYear: String
    joinedYear: String
    jobGrade: JobGrade @cacheControl(maxAge:600)
    
  }

  type MutationResult {
    isSuccess: Boolean
  }

  type Query {
    members: [Member] @cacheControl(maxAge:600)
    filterByRoleMembers(roleId:String!):[Member]
  }
  
  type Mutation {
    registerMember( no:String!, name: String!, gender: String!, birthday: String!, roleId: String!, profileImg: String, jobStartYear: String!, jobTitleId:String! ): MutationResult
  }
`;

const resolvers = {
  Query: {
    members: async (_parent, _args, _context, info) => {
      const { data: members, error: membersError } = await supabase
        .from("Member")
        .select("*");

      return members;
    },
    filterByRoleMembers: async (_parent, args, _context, info) => {
      const { data: filteredMembers, error: filteredMembersError } =
        await supabase.from("Member").select("*").eq("roleId", args.roleId);

      return filteredMembers;
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
    jobGrade: async (parent) => {
      const { data: jobTitles, error: jobTitlesError } = await supabase
        .from("JobTitle")
        .select("*");

      return jobTitles.find((jobTitle) => jobTitle.id === parent.jobTitleId);
    },
  },
  Mutation: {
    registerMember: async (_parent, args) => {
      try {
        const { data, error } = await supabase
          .from("Member")
          .insert([
            {
              no: args.no,
              name: args.name,
              gender: args.gender,
              birthday: args.birthday,
              roleId: args.roleId,
              profileImg:
                args.profileImg ??
                "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
              jobStartYear: args.jobStartYear,
              jobTitleId: args.jobTitle,
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
