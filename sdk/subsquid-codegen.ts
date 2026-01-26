import { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "https://7e27672d-eadb-408b-b9b8-71f30d76effd.squids.live/0xmarkets-base-sepolia@v1/api/graphql",
  overwrite: true,
  debug: true,
  generates: {
    "./src/types/subsquid.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        // Prevent duplicate types
        namingConvention: "keep",
        declarationKind: "interface",

        // Make BigInt output string instead of any
        scalars: {
          BigInt: {
            input: "number",
            output: "string",
          },
        },

        addEslintDisable: true,
      },
    },
  },
};

export default config;
