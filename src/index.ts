#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios";
import dotenv from "dotenv";

// 環境変数を読み込み
dotenv.config();

// 環境変数のバリデーション
const ConfigSchema = z.object({
  GOOGLE_API_KEY: z.string().min(1, "Google API key is required"),
  GOOGLE_SEARCH_ENGINE_ID: z.string().min(1, "Google Search Engine ID is required"),
  REDMINE_URL: z.string().url().optional(),
  REDMINE_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

const config = ConfigSchema.parse(process.env);

// Google Custom Search APIのレスポンス型定義
interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  pagemap?: {
    metatags?: Array<{ [key: string]: string }>;
    cse_image?: Array<{ src: string }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
  queries?: {
    request?: Array<{
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
    }>;
  };
}

// Redmine API関連の型定義
interface RedmineIssue {
  id: number;
  project: {
    id: number;
    name: string;
  };
  tracker: {
    id: number;
    name: string;
  };
  status: {
    id: number;
    name: string;
  };
  priority: {
    id: number;
    name: string;
  };
  author: {
    id: number;
    name: string;
  };
  assigned_to?: {
    id: number;
    name: string;
  };
  subject: string;
  description: string;
  start_date?: string;
  due_date?: string;
  done_ratio: number;
  estimated_hours?: number;
  created_on: string;
  updated_on: string;
  custom_fields?: Array<{
    id: number;
    name: string;
    value: string | string[];
  }>;
}

interface RedmineProject {
  id: number;
  name: string;
  identifier: string;
  description: string;
  status: number;
  is_public: boolean;
  created_on: string;
  updated_on: string;
}

interface RedmineUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  mail: string;
  created_on: string;
  last_login_on?: string;
}

interface RedmineTimeEntry {
  id: number;
  project: {
    id: number;
    name: string;
  };
  issue?: {
    id: number;
  };
  user: {
    id: number;
    name: string;
  };
  activity: {
    id: number;
    name: string;
  };
  hours: number;
  comments: string;
  spent_on: string;
  created_on: string;
  updated_on: string;
}

// 検索パラメータのバリデーションスキーマ
const SearchParamsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  num: z.number().int().min(1).max(10).default(10).optional(),
  start: z.number().int().min(1).default(1).optional(),
  lr: z.string().optional(), // 言語制限
  safe: z.enum(["active", "off"]).default("active").optional(),
  siteSearch: z.string().optional(), // 特定サイト内検索
  fileType: z.string().optional(), // ファイルタイプ制限
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

// Redmine APIパラメータのバリデーションスキーマ
const RedmineIssuesParamsSchema = z.object({
  project_id: z.number().int().positive().optional(),
  status_id: z.union([z.number().int().positive(), z.literal("open"), z.literal("closed"), z.literal("*")]).optional(),
  assigned_to_id: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).default(25).optional(),
  offset: z.number().int().min(0).default(0).optional(),
  sort: z.string().optional(),
  created_on: z.string().optional(),
  updated_on: z.string().optional(),
});

const RedmineCreateIssueSchema = z.object({
  project_id: z.number().int().positive(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  tracker_id: z.number().int().positive().optional(),
  status_id: z.number().int().positive().optional(),
  priority_id: z.number().int().positive().optional(),
  assigned_to_id: z.number().int().positive().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  estimated_hours: z.number().positive().optional(),
});

const RedmineProjectsParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

// 新しい課題更新用スキーマ
const RedmineUpdateIssueSchema = z.object({
  issue_id: z.number().int().positive(),
  status_id: z.number().int().positive().optional(),
  assigned_to_id: z.number().int().positive().optional(),
  done_ratio: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  priority_id: z.number().int().positive().optional(),
  due_date: z.string().optional(),
  estimated_hours: z.number().positive().optional(),
  custom_fields: z.array(z.object({
    id: z.number().int().positive(),
    value: z.string()
  })).optional(),
});

const RedmineBulkUpdateIssuesSchema = z.object({
  issue_ids: z.array(z.number().int().positive()).min(1),
  status_id: z.number().int().positive().optional(),
  assigned_to_id: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

type RedmineIssuesParams = z.infer<typeof RedmineIssuesParamsSchema>;
type RedmineCreateIssueParams = z.infer<typeof RedmineCreateIssueSchema>;
type RedmineUpdateIssueParams = z.infer<typeof RedmineUpdateIssueSchema>;
type RedmineBulkUpdateIssuesParams = z.infer<typeof RedmineBulkUpdateIssuesSchema>;
type RedmineProjectsParams = z.infer<typeof RedmineProjectsParamsSchema>;

class IntegratedSearchServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "integrated-search-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "google_search",
          description: "Search the web using Google Custom Search API",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query string",
              },
              num: {
                type: "number",
                description: "Number of search results to return (1-10, default: 10)",
                minimum: 1,
                maximum: 10,
                default: 10,
              },
              start: {
                type: "number",
                description: "The index of the first result to return (default: 1)",
                minimum: 1,
                default: 1,
              },
              lr: {
                type: "string",
                description: "Language restriction (e.g., 'lang_en', 'lang_ja')",
              },
              safe: {
                type: "string",
                description: "Safe search setting",
                enum: ["active", "off"],
                default: "active",
              },
              siteSearch: {
                type: "string",
                description: "Restrict search to a specific site (e.g., 'example.com')",
              },
              fileType: {
                type: "string",
                description: "Restrict search to specific file types (e.g., 'pdf', 'doc')",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "google_search_images",
          description: "Search for images using Google Custom Search API",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The image search query string",
              },
              num: {
                type: "number",
                description: "Number of image results to return (1-10, default: 10)",
                minimum: 1,
                maximum: 10,
                default: 10,
              },
              start: {
                type: "number",
                description: "The index of the first result to return (default: 1)",
                minimum: 1,
                default: 1,
              },
              safe: {
                type: "string",
                description: "Safe search setting",
                enum: ["active", "off"],
                default: "active",
              },
              imgSize: {
                type: "string",
                description: "Image size filter",
                enum: ["huge", "icon", "large", "medium", "small", "xlarge", "xxlarge"],
              },
              imgType: {
                type: "string",
                description: "Image type filter",
                enum: ["clipart", "face", "lineart", "stock", "photo", "animated"],
              },
            },
            required: ["query"],
          },
        },
        {
          name: "redmine_list_issues",
          description: "List issues from Redmine using REST API",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "number",
                description: "Project ID to filter issues (optional)",
              },
              status_id: {
                oneOf: [
                  { type: "number", description: "Specific status ID" },
                  { type: "string", enum: ["open", "closed", "*"], description: "Status filter: open, closed, or * for all" }
                ],
                description: "Status filter for issues (optional)",
              },
              assigned_to_id: {
                type: "number",
                description: "User ID to filter by assignee (optional)",
              },
              limit: {
                type: "number",
                description: "Number of issues to return (1-100, default: 25)",
                minimum: 1,
                maximum: 100,
                default: 25,
              },
              offset: {
                type: "number",
                description: "Offset for pagination (default: 0)",
                minimum: 0,
                default: 0,
              },
              sort: {
                type: "string",
                description: "Sort criteria (e.g., 'id:desc', 'created_on:asc')",
              },
            },
            required: [],
          },
        },
        {
          name: "redmine_create_issue",
          description: "Create a new issue in Redmine",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "number",
                description: "Project ID where the issue will be created",
              },
              subject: {
                type: "string",
                description: "Issue subject/title",
              },
              description: {
                type: "string",
                description: "Issue description (optional)",
              },
              tracker_id: {
                type: "number",
                description: "Tracker ID (optional, defaults to project default)",
              },
              status_id: {
                type: "number",
                description: "Status ID (optional, defaults to project default)",
              },
              priority_id: {
                type: "number",
                description: "Priority ID (optional, defaults to normal)",
              },
              assigned_to_id: {
                type: "number",
                description: "Assignee user ID (optional)",
              },
              start_date: {
                type: "string",
                description: "Start date in YYYY-MM-DD format (optional)",
              },
              due_date: {
                type: "string",
                description: "Due date in YYYY-MM-DD format (optional)",
              },
              estimated_hours: {
                type: "number",
                description: "Estimated hours (optional)",
              },
            },
            required: ["project_id", "subject"],
          },
        },
        {
          name: "redmine_list_projects",
          description: "List projects from Redmine",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Number of projects to return (1-100, default: 25)",
                minimum: 1,
                maximum: 100,
                default: 25,
              },
              offset: {
                type: "number",
                description: "Offset for pagination (default: 0)",
                minimum: 0,
                default: 0,
              },
            },
            required: [],
          },
        },
        {
          name: "redmine_get_issue",
          description: "Get a specific issue by ID from Redmine",
          inputSchema: {
            type: "object",
            properties: {
              issue_id: {
                type: "number",
                description: "Issue ID to retrieve",
              },
              include: {
                type: "string",
                description: "Additional data to include (e.g., 'journals,changesets,attachments')",
              },
            },
            required: ["issue_id"],
          },
        },
        {
          name: "redmine_update_issue",
          description: "Update an existing Redmine issue (単一課題の更新)",
          inputSchema: {
            type: "object",
            properties: {
              issue_id: {
                type: "number",
                description: "Issue ID to update",
              },
              status_id: {
                type: "number",
                description: "New status ID (optional)",
              },
              assigned_to_id: {
                type: "number",
                description: "New assignee user ID (optional)",
              },
              done_ratio: {
                type: "number",
                description: "Progress percentage (0-100, optional)",
                minimum: 0,
                maximum: 100,
              },
              notes: {
                type: "string",
                description: "Comment/notes to add (optional)",
              },
              priority_id: {
                type: "number",
                description: "New priority ID (optional)",
              },
              due_date: {
                type: "string",
                description: "Due date in YYYY-MM-DD format (optional)",
              },
              estimated_hours: {
                type: "number",
                description: "Estimated hours (optional)",
                minimum: 0,
              },
              custom_fields: {
                type: "array",
                description: "Custom fields to update (optional)",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "number",
                      description: "Custom field ID",
                    },
                    value: {
                      type: "string",
                      description: "Custom field value",
                    },
                  },
                  required: ["id", "value"],
                },
              },
            },
            required: ["issue_id"],
          },
        },
        {
          name: "redmine_bulk_update_issues",
          description: "Update multiple Redmine issues at once (一括課題更新)",
          inputSchema: {
            type: "object",
            properties: {
              issue_ids: {
                type: "array",
                description: "Array of issue IDs to update",
                items: {
                  type: "number",
                },
                minItems: 1,
              },
              status_id: {
                type: "number",
                description: "New status ID for all issues (optional)",
              },
              assigned_to_id: {
                type: "number",
                description: "New assignee user ID for all issues (optional)",
              },
              notes: {
                type: "string",
                description: "Comment/notes to add to all issues (optional)",
              },
            },
            required: ["issue_ids"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "google_search":
            return await this.handleGoogleSearch(request.params.arguments || {});
          case "google_search_images":
            return await this.handleGoogleImageSearch(request.params.arguments || {});
          case "redmine_list_issues":
            return await this.handleRedmineListIssues(request.params.arguments || {});
          case "redmine_create_issue":
            return await this.handleRedmineCreateIssue(request.params.arguments || {});
          case "redmine_list_projects":
            return await this.handleRedmineListProjects(request.params.arguments || {});
          case "redmine_get_issue":
            return await this.handleRedmineGetIssue(request.params.arguments || {});
          case "redmine_update_issue":
            return await this.handleRedmineUpdateIssue(request.params.arguments || {});
          case "redmine_bulk_update_issues":
            return await this.handleRedmineBulkUpdateIssues(request.params.arguments || {});
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        // エラーが既にMcpErrorの場合はそのまま再スロー
        if (error instanceof McpError) {
          throw error;
        }
        // その他のエラーはMcpErrorに変換
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });
  }

  private async handleGoogleSearch(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const params = SearchParamsSchema.parse(args);
      
      const searchResults = await this.performSearch(params);
      
      if (!searchResults.items || searchResults.items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No search results found for query: "${params.query}"`,
            },
          ],
        };
      }

      const formattedResults = this.formatSearchResults(searchResults, params.query);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`
        );
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        if (status === 403) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Google Custom Search API quota exceeded or invalid API key"
          );
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Google Search API error: ${message}`
        );
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleGoogleImageSearch(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const baseParams = SearchParamsSchema.parse(args);
      const additionalParams = z.object({
        imgSize: z.string().optional(),
        imgType: z.string().optional(),
      }).parse(args);
      
      const params = { ...baseParams, ...additionalParams };
      
      const searchResults = await this.performSearch(params, "image");
      
      if (!searchResults.items || searchResults.items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No image search results found for query: "${params.query}"`,
            },
          ],
        };
      }

      const formattedResults = this.formatImageSearchResults(searchResults, params.query);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`
        );
      }
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        if (status === 403) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Google Custom Search API quota exceeded or invalid API key"
          );
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Google Image Search API error: ${message}`
        );
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Image search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async performSearch(
    params: SearchParams & { imgSize?: string; imgType?: string },
    searchType: "web" | "image" = "web"
  ): Promise<GoogleSearchResponse> {
    const url = "https://www.googleapis.com/customsearch/v1";
    
    const searchParams: Record<string, string | number> = {
      key: config.GOOGLE_API_KEY,
      cx: config.GOOGLE_SEARCH_ENGINE_ID,
      q: params.query,
      num: params.num || 10,
      start: params.start || 1,
      safe: params.safe || "active",
    };

    // 画像検索の場合
    if (searchType === "image") {
      searchParams.searchType = "image";
      if (params.imgSize) searchParams.imgSize = params.imgSize;
      if (params.imgType) searchParams.imgType = params.imgType;
    }

    // オプションパラメータの追加
    if (params.lr) searchParams.lr = params.lr;
    if (params.siteSearch) searchParams.siteSearch = params.siteSearch;
    if (params.fileType) searchParams.fileType = params.fileType;

    this.log("debug", `Performing ${searchType} search with params:`, searchParams);

    const response = await axios.get<GoogleSearchResponse>(url, {
      params: searchParams,
      timeout: 10000,
    });

    return response.data;
  }

  private formatSearchResults(results: GoogleSearchResponse, query: string): string {
    const { items, searchInformation } = results;
    
    if (!items) return `No results found for "${query}"`;

    const totalResults = searchInformation?.totalResults || "Unknown";
    const searchTime = searchInformation?.searchTime || 0;

    let formatted = `Google Search Results for "${query}"\n`;
    formatted += `Found approximately ${totalResults} results (${searchTime} seconds)\n\n`;

    items.forEach((item, index) => {
      formatted += `${index + 1}. ${item.title}\n`;
      formatted += `   URL: ${item.link}\n`;
      formatted += `   ${item.snippet}\n`;
      
      // メタ情報があれば追加
      if (item.pagemap?.metatags?.[0]) {
        const meta = item.pagemap.metatags[0];
        if (meta["og:description"] && meta["og:description"] !== item.snippet) {
          formatted += `   Description: ${meta["og:description"]}\n`;
        }
      }
      
      formatted += `\n`;
    });

    return formatted;
  }

  private formatImageSearchResults(results: GoogleSearchResponse, query: string): string {
    const { items, searchInformation } = results;
    
    if (!items) return `No image results found for "${query}"`;

    const totalResults = searchInformation?.totalResults || "Unknown";
    const searchTime = searchInformation?.searchTime || 0;

    let formatted = `Google Image Search Results for "${query}"\n`;
    formatted += `Found approximately ${totalResults} results (${searchTime} seconds)\n\n`;

    items.forEach((item, index) => {
      formatted += `${index + 1}. ${item.title}\n`;
      formatted += `   Image URL: ${item.link}\n`;
      formatted += `   Source: ${item.displayLink}\n`;
      
      if (item.snippet) {
        formatted += `   Context: ${item.snippet}\n`;
      }
      
      // 画像のメタ情報があれば追加
      if (item.pagemap?.cse_image?.[0]) {
        formatted += `   Thumbnail: ${item.pagemap.cse_image[0].src}\n`;
      }
      
      formatted += `\n`;
    });

    return formatted;
  }

  // Redmine API関連メソッド
  private async handleRedmineListIssues(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = RedmineIssuesParamsSchema.parse(args);
      
      const url = `${config.REDMINE_URL}/issues.json`;
      const queryParams: Record<string, string | number> = {
        limit: params.limit || 25,
        offset: params.offset || 0,
      };

      if (params.project_id) queryParams.project_id = params.project_id;
      if (params.status_id !== undefined) queryParams.status_id = params.status_id;
      if (params.assigned_to_id) queryParams.assigned_to_id = params.assigned_to_id;
      if (params.sort) queryParams.sort = params.sort;
      if (params.created_on) queryParams.created_on = params.created_on;
      if (params.updated_on) queryParams.updated_on = params.updated_on;

      this.log("debug", `Fetching Redmine issues with params:`, queryParams);

      const response = await axios.get(url, {
        params: queryParams,
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      const issues: RedmineIssue[] = response.data.issues || [];
      const totalCount = response.data.total_count || 0;

      const formattedResults = this.formatRedmineIssues(issues, totalCount, params);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to list Redmine issues");
      // この行には到達しない（handleRedmineErrorが例外をスローするため）
      throw error;
    }
  }

  private async handleRedmineCreateIssue(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = RedmineCreateIssueSchema.parse(args);
      
      const url = `${config.REDMINE_URL}/issues.json`;
      const issueData = {
        issue: {
          project_id: params.project_id,
          subject: params.subject,
          description: params.description || "",
          tracker_id: params.tracker_id,
          status_id: params.status_id,
          priority_id: params.priority_id,
          assigned_to_id: params.assigned_to_id,
          start_date: params.start_date,
          due_date: params.due_date,
          estimated_hours: params.estimated_hours,
        },
      };

      this.log("debug", `Creating Redmine issue:`, issueData);

      const response = await axios.post(url, issueData, {
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      const createdIssue: RedmineIssue = response.data.issue;
      const formattedResult = this.formatRedmineIssueCreated(createdIssue);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResult,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to create Redmine issue");
      // この行には到達しない（handleRedmineErrorが例外をスローするため）
      throw error;
    }
  }

  private async handleRedmineListProjects(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = RedmineProjectsParamsSchema.parse(args);
      
      const url = `${config.REDMINE_URL}/projects.json`;
      const queryParams: Record<string, string | number> = {
        limit: params.limit || 25,
        offset: params.offset || 0,
      };

      this.log("debug", `Fetching Redmine projects with params:`, queryParams);

      const response = await axios.get(url, {
        params: queryParams,
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      const projects: RedmineProject[] = response.data.projects || [];
      const totalCount = response.data.total_count || 0;

      const formattedResults = this.formatRedmineProjects(projects, totalCount, params);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to list Redmine projects");
      // この行には到達しない（handleRedmineErrorが例外をスローするため）
      throw error;
    }
  }

  private async handleRedmineGetIssue(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = z.object({
        issue_id: z.number().int().positive(),
        include: z.string().optional(),
      }).parse(args);
      
      const url = `${config.REDMINE_URL}/issues/${params.issue_id}.json`;
      const queryParams: Record<string, string> = {};
      
      if (params.include) {
        queryParams.include = params.include;
      }

      this.log("debug", `Fetching Redmine issue ${params.issue_id} with params:`, queryParams);

      const response = await axios.get(url, {
        params: queryParams,
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      const issue: RedmineIssue = response.data.issue;
      const formattedResult = this.formatRedmineIssueDetail(issue);
      
      return {
        content: [
          {
            type: "text",
            text: formattedResult,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to get Redmine issue");
      // この行には到達しない（handleRedmineErrorが例外をスローするため）
      throw error;
    }
  }

  private validateRedmineConfig(): void {
    if (!config.REDMINE_URL || !config.REDMINE_API_KEY) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Redmine configuration is missing. Please set REDMINE_URL and REDMINE_API_KEY environment variables."
      );
    }
  }

  private getRedmineHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Redmine-API-Key": config.REDMINE_API_KEY!,
    };
  }

  private formatRedmineIssues(issues: RedmineIssue[], totalCount: number, params: RedmineIssuesParams): string {
    if (issues.length === 0) {
      return "No Redmine issues found matching the criteria.";
    }

    let formatted = `Redmine Issues (${issues.length} of ${totalCount} total)\n`;
    if (params.project_id) formatted += `Project ID: ${params.project_id}\n`;
    if (params.status_id) formatted += `Status: ${params.status_id}\n`;
    formatted += `\n`;

    issues.forEach((issue, index) => {
      formatted += `${index + 1}. #${issue.id} - ${issue.subject}\n`;
      formatted += `   Project: ${issue.project.name}\n`;
      formatted += `   Status: ${issue.status.name}\n`;
      formatted += `   Priority: ${issue.priority.name}\n`;
      formatted += `   Author: ${issue.author.name}\n`;
      
      if (issue.assigned_to) {
        formatted += `   Assignee: ${issue.assigned_to.name}\n`;
      }
      
      if (issue.due_date) {
        formatted += `   Due Date: ${issue.due_date}\n`;
      }
      
      if (issue.description) {
        const shortDesc = issue.description.length > 100 
          ? issue.description.substring(0, 100) + "..."
          : issue.description;
        formatted += `   Description: ${shortDesc}\n`;
      }
      
      formatted += `   Created: ${new Date(issue.created_on).toLocaleDateString()}\n`;
      formatted += `   Updated: ${new Date(issue.updated_on).toLocaleDateString()}\n`;
      formatted += `\n`;
    });

    return formatted;
  }

  private formatRedmineIssueCreated(issue: RedmineIssue): string {
    let formatted = `✅ Redmine Issue Created Successfully!\n\n`;
    formatted += `Issue #${issue.id}: ${issue.subject}\n`;
    formatted += `Project: ${issue.project.name}\n`;
    formatted += `Status: ${issue.status.name}\n`;
    formatted += `Priority: ${issue.priority.name}\n`;
    formatted += `Author: ${issue.author.name}\n`;
    
    if (issue.assigned_to) {
      formatted += `Assignee: ${issue.assigned_to.name}\n`;
    }
    
    if (issue.due_date) {
      formatted += `Due Date: ${issue.due_date}\n`;
    }
    
    if (issue.description) {
      formatted += `\nDescription:\n${issue.description}\n`;
    }
    
    formatted += `\nCreated: ${new Date(issue.created_on).toLocaleString()}\n`;

    return formatted;
  }

  private formatRedmineProjects(projects: RedmineProject[], totalCount: number, params: RedmineProjectsParams): string {
    if (projects.length === 0) {
      return "No Redmine projects found.";
    }

    let formatted = `Redmine Projects (${projects.length} of ${totalCount} total)\n\n`;

    projects.forEach((project, index) => {
      formatted += `${index + 1}. ${project.name} (${project.identifier})\n`;
      formatted += `   ID: ${project.id}\n`;
      formatted += `   Status: ${project.status === 1 ? "Active" : "Closed"}\n`;
      formatted += `   Public: ${project.is_public ? "Yes" : "No"}\n`;
      
      if (project.description) {
        const shortDesc = project.description.length > 100 
          ? project.description.substring(0, 100) + "..."
          : project.description;
        formatted += `   Description: ${shortDesc}\n`;
      }
      
      formatted += `   Created: ${new Date(project.created_on).toLocaleDateString()}\n`;
      formatted += `\n`;
    });

    return formatted;
  }

  private formatRedmineIssueDetail(issue: RedmineIssue): string {
    let formatted = `Redmine Issue #${issue.id}: ${issue.subject}\n\n`;
    formatted += `Project: ${issue.project.name}\n`;
    formatted += `Tracker: ${issue.tracker.name}\n`;
    formatted += `Status: ${issue.status.name}\n`;
    formatted += `Priority: ${issue.priority.name}\n`;
    formatted += `Author: ${issue.author.name}\n`;
    
    if (issue.assigned_to) {
      formatted += `Assignee: ${issue.assigned_to.name}\n`;
    }
    
    if (issue.start_date) {
      formatted += `Start Date: ${issue.start_date}\n`;
    }
    
    if (issue.due_date) {
      formatted += `Due Date: ${issue.due_date}\n`;
    }
    
    if (issue.estimated_hours) {
      formatted += `Estimated Hours: ${issue.estimated_hours}\n`;
    }
    
    formatted += `Done Ratio: ${issue.done_ratio}%\n`;
    
    if (issue.description) {
      formatted += `\nDescription:\n${issue.description}\n`;
    }
    
    // カスタムフィールドがあれば表示
    if (issue.custom_fields && issue.custom_fields.length > 0) {
      formatted += `\nCustom Fields:\n`;
      issue.custom_fields.forEach(field => {
        const value = Array.isArray(field.value) ? field.value.join(", ") : field.value;
        formatted += `  ${field.name}: ${value}\n`;
      });
    }
    
    formatted += `\nCreated: ${new Date(issue.created_on).toLocaleString()}\n`;
    formatted += `Updated: ${new Date(issue.updated_on).toLocaleString()}\n`;

    return formatted;
  }

  // 新しい課題更新機能の実装
  private async handleRedmineUpdateIssue(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = RedmineUpdateIssueSchema.parse(args);
      
      const url = `${config.REDMINE_URL}/issues/${params.issue_id}.json`;
      
      // 更新データの構築
      const updateData: any = { issue: {} };
      
      if (params.status_id !== undefined) updateData.issue.status_id = params.status_id;
      if (params.assigned_to_id !== undefined) updateData.issue.assigned_to_id = params.assigned_to_id;
      if (params.done_ratio !== undefined) updateData.issue.done_ratio = params.done_ratio;
      if (params.notes !== undefined) updateData.issue.notes = params.notes;
      if (params.priority_id !== undefined) updateData.issue.priority_id = params.priority_id;
      if (params.due_date !== undefined) updateData.issue.due_date = params.due_date;
      if (params.estimated_hours !== undefined) updateData.issue.estimated_hours = params.estimated_hours;
      if (params.custom_fields !== undefined) updateData.issue.custom_fields = params.custom_fields;

      this.log("debug", `Updating Redmine issue ${params.issue_id}:`, updateData);

      const response = await axios.put(url, updateData, {
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      // 更新後の課題情報を取得
      const getResponse = await axios.get(url, {
        headers: this.getRedmineHeaders(),
        timeout: 10000,
      });

      const updatedIssue: RedmineIssue = getResponse.data.issue;
      let formattedResult = `✅ Redmine Issue #${params.issue_id} Updated Successfully!\n\n`;
      
      // 更新された項目を表示
      const updates: string[] = [];
      if (params.status_id !== undefined) updates.push(`Status: ${updatedIssue.status.name}`);
      if (params.assigned_to_id !== undefined) {
        updates.push(`Assignee: ${updatedIssue.assigned_to ? updatedIssue.assigned_to.name : 'Unassigned'}`);
      }
      if (params.done_ratio !== undefined) updates.push(`Progress: ${updatedIssue.done_ratio}%`);
      if (params.priority_id !== undefined) updates.push(`Priority: ${updatedIssue.priority.name}`);
      if (params.due_date !== undefined) updates.push(`Due Date: ${updatedIssue.due_date || 'Not set'}`);
      if (params.estimated_hours !== undefined) updates.push(`Estimated Hours: ${updatedIssue.estimated_hours || 'Not set'}`);
      if (params.notes !== undefined) updates.push(`Notes added: ${params.notes}`);
      
      formattedResult += `Updated: ${updates.join(', ')}\n\n`;
      formattedResult += `Issue: #${updatedIssue.id} - ${updatedIssue.subject}\n`;
      formattedResult += `Project: ${updatedIssue.project.name}\n`;
      formattedResult += `Last Updated: ${new Date(updatedIssue.updated_on).toLocaleString()}\n`;
      
      return {
        content: [
          {
            type: "text",
            text: formattedResult,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to update Redmine issue");
      throw error;
    }
  }

  private async handleRedmineBulkUpdateIssues(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      this.validateRedmineConfig();
      const params = RedmineBulkUpdateIssuesSchema.parse(args);
      
      const updates: string[] = [];
      const failures: string[] = [];
      
      // 各課題を順次更新
      for (const issueId of params.issue_ids) {
        try {
          const url = `${config.REDMINE_URL}/issues/${issueId}.json`;
          
          // 更新データの構築
          const updateData: any = { issue: {} };
          
          if (params.status_id !== undefined) updateData.issue.status_id = params.status_id;
          if (params.assigned_to_id !== undefined) updateData.issue.assigned_to_id = params.assigned_to_id;
          if (params.notes !== undefined) updateData.issue.notes = params.notes;

          this.log("debug", `Bulk updating Redmine issue ${issueId}:`, updateData);

          await axios.put(url, updateData, {
            headers: this.getRedmineHeaders(),
            timeout: 10000,
          });

          updates.push(`Issue #${issueId}`);
        } catch (error) {
          this.log("warn", `Failed to update issue ${issueId}:`, error);
          failures.push(`Issue #${issueId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      let formattedResult = `📦 Bulk Update Results\n\n`;
      
      if (updates.length > 0) {
        formattedResult += `✅ Successfully Updated (${updates.length}):\n`;
        formattedResult += updates.join(', ') + '\n\n';
        
        // 更新内容の詳細
        const updateDetails: string[] = [];
        if (params.status_id !== undefined) updateDetails.push(`Status ID: ${params.status_id}`);
        if (params.assigned_to_id !== undefined) updateDetails.push(`Assigned to User ID: ${params.assigned_to_id}`);
        if (params.notes !== undefined) updateDetails.push(`Notes: ${params.notes}`);
        
        formattedResult += `Updated Fields: ${updateDetails.join(', ')}\n\n`;
      }
      
      if (failures.length > 0) {
        formattedResult += `❌ Failed to Update (${failures.length}):\n`;
        failures.forEach(failure => {
          formattedResult += `  ${failure}\n`;
        });
      }
      
      formattedResult += `\nTotal Processed: ${params.issue_ids.length} issues\n`;
      formattedResult += `Completed: ${new Date().toLocaleString()}`;
      
      return {
        content: [
          {
            type: "text",
            text: formattedResult,
          },
        ],
      };
    } catch (error) {
      this.handleRedmineError(error, "Failed to bulk update Redmine issues");
      throw error;
    }
  }

  private handleRedmineError(error: unknown, defaultMessage: string) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(", ")}`
      );
    }
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.errors || error.response?.data?.error || error.message;
      
      if (status === 401) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Redmine authentication failed. Please check your API key."
        );
      }
      
      if (status === 403) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Redmine access forbidden. Check your permissions."
        );
      }
      
      if (status === 404) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Redmine resource not found."
        );
      }
      
      if (status === 422) {
        const errorMsg = Array.isArray(message) ? message.join(", ") : message;
        throw new McpError(
          ErrorCode.InvalidParams,
          `Redmine validation error: ${errorMsg}`
        );
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Redmine API error: ${JSON.stringify(message)}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `${defaultMessage}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.log("error", "Server error:", error);
    };

    process.on("SIGINT", async () => {
      this.log("info", "Received SIGINT, shutting down gracefully...");
      await this.server.close();
      process.exit(0);
    });
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[config.LOG_LEVEL as keyof typeof logLevels] ?? 2;
    const messageLevel = logLevels[level as keyof typeof logLevels] ?? 2;

    if (messageLevel <= currentLevel) {
      console.error(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, ...args);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log("info", "Google Custom Search MCP Server running on stdio");
  }
}

// メイン実行
async function main(): Promise<void> {
  try {
    const server = new IntegratedSearchServer();
    await server.run();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
