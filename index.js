const { createClient } = require("@supabase/supabase-js");
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
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

input createMemberMutationInput {
  no:String!
  name: String!
  gender: String!
  birthday: String!
  roleId: String!
  profileImg: String
  jobStartYear: String!
  jobTitleId:String!
  joinedYear: String!
  }

input updateMemberMutationInput {
  id: Int!
  no:String
  name: String
  gender: String
  birthday: String
  roleId: String
  profileImg: String
  jobStartYear: String
  jobTitleId:String
  joinedYear: String
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
    id: Int
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
    createMember(createInfo:createMemberMutationInput): MutationResult
    updateMember(updateInfo:updateMemberMutationInput): MutationResult
    deleteMember(id: Int): MutationResult
  }
`;

const resolvers = {
  Query: {
    members: async (_parent, _args, _context, info) => {
      const { data, error } = await supabase.from("Member").select("*");

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    filteredMembers: async (_parent, args, _context, info) => {
      let query = supabase.from("Member").select("*");

      const filterInfo = args.filteredMemberInfo;
      for (const key in filterInfo) {
        query = query.eq(key, filterInfo[key]);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  },
  Member: {
    role: async (parent, _args, _context, info) => {
      const { data: roles, error: rolesError } = await supabase
        .from("Role")
        .select("*");

      console.log("cache?!");

      if (rolesError) {
        throw new Error(rolesError);
      }

      return roles.find((role) => role.id === parent.roleId);
    },
    jobTitle: async (parent) => {
      const { data: jobTitles, error: jobTitlesError } = await supabase
        .from("JobTitle")
        .select("*");

      if (jobTitlesError) {
        throw new Error(jobTitlesError.message);
      }

      return jobTitles.find((jobTitle) => jobTitle.id === parent.jobTitleId);
    },
  },
  Mutation: {
    createMember: async (_parent, args) => {
      const input = args.createInfo;
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

      if (error) {
        throw new Error(error.message);
      }

      return data.length > 0 ? { isSuccess: true } : { isSuccess: false };
    },
    updateMember: async (_parent, args) => {
      const { data: originalMember, error: originalMemberError } =
        await supabase.from("Member").select("*").eq("id", args.updateInfo.id);

      const input = args.updateInfo;
      const { data, error } = await supabase
        .from("Member")
        .update([
          {
            no: input.no ?? originalMember.no,
            name: input.name ?? originalMember.name,
            gender: input.gender ?? originalMember.gender,
            birthday: input.birthday ?? originalMember.birthday,
            roleId: input.roleId ?? originalMember.roleId,
            profileImg: input.profileImg ?? originalMember.profileImg,
            jobStartYear: input.jobStartYear ?? originalMember.jobStartYear,
            jobTitleId: input.jobTitle ?? originalMember.jobTitle,
          },
        ])
        .eq("id", input.id)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return data.length > 0 ? { isSuccess: true } : { isSuccess: false };
    },
    deleteMember: async (_parent, args) => {
      const { data, error } = await supabase
        .from("Member")
        .delete()
        .eq("id", args.id)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      return data.length > 0 ? { isSuccess: true } : { isSuccess: false };
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
      listen: { port: 4003 },
      context: ({ req }) => {
        // console.log(req.headers);
      },
    });
    console.log(`🚀  Server ready at: ${url}`);
  } catch (e) {
    console.log(e);
  }
})();
