# Integrated Search MCP Server

A Model Context Protocol (MCP) server that provides both Google Custom Search API and Redmine API integration, allowing AI assistants to search the web and manage Redmine projects seamlessly.

## Features

### Google Custom Search
- **Web Search**: Search the web using Google Custom Search API
- **Image Search**: Find images with advanced filtering options
- **Advanced Parameters**: Support for language restrictions, site-specific searches, file type filtering, and more

### Redmine API Integration
- **Issue Management**: List, create, view, and update Redmine issues with detailed analysis
- **Project Management**: Browse Redmine projects
- **Advanced Filtering**: Filter issues by project, status, assignee, and more
- **Comprehensive Details**: Access full issue information including custom fields
- **Bulk Operations**: Update multiple issues simultaneously
- **Smart Progress Tracking**: Update issue progress, due dates, estimated hours, and assignment with workflow-aware error handling
- **Detailed Update Reports**: Before/after comparison showing which fields succeeded and which failed due to Redmine constraints
- **Workflow-Aware Updates**: Intelligent handling of Redmine workflow restrictions and field permissions

### Common Features
- **Error Handling**: Robust error handling with detailed error messages
- **Input Validation**: Comprehensive input validation using Zod schemas
- **Configurable**: Environment-based configuration
- **Dual API Support**: Seamlessly switch between Google Search and Redmine operations

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd mcp-integrated-search-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your API credentials:
```env
# Google Custom Search API Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id_here

# Redmine API Configuration (optional)
REDMINE_URL=https://your-redmine-instance.com
REDMINE_API_KEY=your_redmine_api_key_here

# MCP Server Configuration
LOG_LEVEL=info
```

5. Build the project:
```bash
npm run build
```

## Google API Setup

### 1. Get Google API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Go to "Credentials" and create an API key
5. Restrict the API key to Custom Search API for security

### 2. Create Custom Search Engine

1. Go to [Google Custom Search Engine](https://cse.google.com/cse/)
2. Click "Add" to create a new search engine
3. Enter a site to search (you can use `*` to search the entire web)
4. Click "Create"
5. Go to "Setup" and copy the "Search engine ID"

## Redmine API Setup

### Multi-Repository (Recommended)

This server supports multiple Redmine repositories with secure secret handling.

1. Create a config file from the example:
```powershell
Copy-Item redmine-repositories.example.json redmine-repositories.json
```

2. Set environment variables referenced by the config (see `.env.example`):
```powershell
Copy-Item .env.example .env
# then edit .env to set REDMINE_MAIN_API_KEY, REDMINE_DEV_API_KEY, etc.
```

3. Optionally specify a custom config path:
```powershell
$env:REDMINE_CONFIG_PATH = "./redmine-repositories.json"
```

Notes:
- Do not hardcode API keys in JSON. Use `${VAR_NAME}` references.
- When calling any Redmine tool, you may pass `repository_id` to select a repository. If omitted, the default repository is used.

### 1. Get Redmine API Key

1. Log in to your Redmine instance
2. Go to "My account" (usually in the top right corner)
3. Click on "API access key" in the right sidebar
4. Click "Show" to reveal your API key, or "Reset" to generate a new one
5. Copy the API key

### 2. Configure Redmine URL (Legacy single-repository)

1. Set `REDMINE_URL` to your Redmine instance URL (e.g., `https://redmine.example.com`)
2. Set `REDMINE_API_KEY` to your API key from step 1

**Note**: Legacy env-based configuration remains supported as a fallback when multi-repository config is not present.

## Usage

### With Claude Desktop

Add the server to your Claude Desktop configuration:

**MacOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "integrated-search-server": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-integrated-search-server/build/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_google_api_key_here",
        "GOOGLE_SEARCH_ENGINE_ID": "your_custom_search_engine_id_here",
        "REDMINE_URL": "https://your-redmine-instance.com",
        "REDMINE_API_KEY": "your_redmine_api_key_here"
      }
    }
  }
}
```

### Available Tools (8 total)

#### Google Search Tools (2)

#### 1. google_search

Search the web using Google Custom Search API.

**Parameters:**
- `query` (required): The search query string
- `num` (optional): Number of results to return (1-10, default: 10)
- `start` (optional): Starting index for results (default: 1)
- `lr` (optional): Language restriction (e.g., 'lang_en', 'lang_ja')
- `safe` (optional): Safe search setting ('active' or 'off', default: 'active')
- `siteSearch` (optional): Restrict search to specific site (e.g., 'github.com')
- `fileType` (optional): Restrict to file types (e.g., 'pdf', 'doc')

**Example usage:**
```
Search for "TypeScript tutorial" with 5 results
Search for "machine learning" on site:arxiv.org
Search for "documentation" filetype:pdf
```

#### 2. google_search_images

Search for images using Google Custom Search API.

**Parameters:**
- `query` (required): The image search query string
- `num` (optional): Number of results to return (1-10, default: 10)
- `start` (optional): Starting index for results (default: 1)
- `safe` (optional): Safe search setting ('active' or 'off', default: 'active')
- `imgSize` (optional): Image size filter ('huge', 'icon', 'large', 'medium', 'small', 'xlarge', 'xxlarge')
- `imgType` (optional): Image type filter ('clipart', 'face', 'lineart', 'stock', 'photo', 'animated')

**Example usage:**
```
Search for images of "golden retriever"
Find large photos of "sunset landscape"
Search for clipart images of "business icons"
```

#### Redmine API Tools (6)

All Redmine tools accept an optional `repository_id` parameter to target a specific repository. When omitted, the default repository configured in `redmine-repositories.json` is used.

#### 3. redmine_list_issues

List and filter Redmine issues.

**Parameters:**
- `repository_id` (optional): Target repository id (default repository if omitted)
- `project_id` (optional): Project ID to filter issues
- `status_id` (optional): Status ID or 'open', 'closed', '*' for all
- `assigned_to_id` (optional): User ID of the assignee
- `limit` (optional): Number of issues to return (1-100, default: 25)
- `offset` (optional): Starting index for pagination (default: 0)
- `sort` (optional): Sort field (e.g., 'id', 'created_on', 'updated_on')
- `created_on` (optional): Filter by creation date (e.g., '>=2023-01-01')
- `updated_on` (optional): Filter by update date

**Example usage:**
```
List all open issues
List issues for project 1
List issues assigned to user 5
```

#### 4. redmine_create_issue

Create a new Redmine issue.

**Parameters:**
- `repository_id` (optional): Target repository id (default repository if omitted)
- `project_id` (required): Project ID where to create the issue
- `subject` (required): Issue subject/title
- `description` (optional): Issue description
- `tracker_id` (optional): Tracker ID (Bug, Feature, etc.)
- `status_id` (optional): Initial status ID
- `priority_id` (optional): Priority ID
- `assigned_to_id` (optional): User ID to assign the issue to
- `start_date` (optional): Start date (YYYY-MM-DD)
- `due_date` (optional): Due date (YYYY-MM-DD)
- `estimated_hours` (optional): Estimated hours

**Example usage:**
```
Create a bug report for project 1
Create a feature request with high priority
Create an assigned task with due date
```

#### 5. redmine_list_projects

List available Redmine projects.

**Parameters:**
- `limit` (optional): Number of projects to return (1-100, default: 25)
- `offset` (optional): Starting index for pagination (default: 0)

**Example usage:**
```
List all projects
List first 10 projects
Browse projects with pagination
```

#### 6. redmine_get_issue

Get detailed information about a specific Redmine issue.

**Parameters:**
- `issue_id` (required): The ID of the issue to retrieve
- `include` (optional): Additional data to include ('attachments', 'relations', 'journals', 'watchers')

**Example usage:**
```
Get issue #123 details
Get issue #456 with attachments and journals
Get full issue information including relations
```

#### 7. redmine_update_issue

Update an existing Redmine issue with detailed analysis reporting.

**Parameters:**
- `issue_id` (required): The ID of the issue to update
- `status_id` (optional): New status ID (may be restricted by workflow)
- `assigned_to_id` (optional): New assignee user ID
- `done_ratio` (optional): Progress percentage (0-100)
- `notes` (optional): Comment/notes to add
- `priority_id` (optional): New priority ID
- `due_date` (optional): Due date (YYYY-MM-DD format)
- `estimated_hours` (optional): Estimated hours
- `custom_fields` (optional): Array of custom field updates

**Enhanced Features:**
- **Before/After Comparison**: Shows exactly what changed
- **Success/Failure Analysis**: Clearly identifies which fields updated successfully
- **Workflow-Aware**: Explains when Redmine workflow restrictions prevent updates
- **Detailed Reporting**: Provides comprehensive feedback on all attempted changes

**Example usage:**
```
Update issue #123 status to completed
Update issue #456 progress to 75% and add notes
Change assignee and due date for issue #789
```

#### 8. redmine_bulk_update_issues

Update multiple Redmine issues at once.

**Parameters:**
- `issue_ids` (required): Array of issue IDs to update
- `status_id` (optional): New status ID for all issues
- `assigned_to_id` (optional): New assignee user ID for all issues
- `notes` (optional): Comment/notes to add to all issues

**Example usage:**
```
Mark multiple issues as completed
Reassign several issues to a different user
Add bulk comments to multiple issues
```

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Configuration

Environment variables:

- `GOOGLE_API_KEY`: Your Google API key (required for Google Search)
- `GOOGLE_SEARCH_ENGINE_ID`: Your Custom Search Engine ID (required for Google Search)
- `REDMINE_URL`: Your Redmine instance URL (optional, required for Redmine features)
- `REDMINE_API_KEY`: Your Redmine API key (optional, required for Redmine features)
- `LOG_LEVEL`: Logging level ('error', 'warn', 'info', 'debug', default: 'info')

## API Limits

### Google Custom Search API
- 100 queries per day for free
- Up to 10,000 queries per day with billing enabled
- Maximum 10 results per query

### Redmine API
- Limits depend on your Redmine instance configuration
- Most Redmine instances have no built-in API rate limits
- Consider server resources when making bulk requests

## Error Handling

The server provides detailed error messages for common issues:
- Invalid API key or search engine ID
- Quota exceeded
- Invalid parameters
- Network errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the Google Custom Search API documentation
2. Verify your API key and search engine ID
3. Check the server logs for detailed error messages
4. Create an issue in this repository
