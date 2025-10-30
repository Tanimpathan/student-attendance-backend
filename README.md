# Duar Code Test Backend

## Project Description
This project is a backend application for a student management system, providing APIs for authentication, student management, and attendance tracking. It is built with Node.js and Express, using PostgreSQL as its database.

## Prerequisites
Before running this project, ensure you have the following installed:
- Docker
- Docker Compose

## Getting Started
To set up and run the project using Docker Compose:

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repository-url>
    cd duar-code-test-backend
    ```

2.  **Build and run the Docker containers:**
    This command will build the Docker images (if not already built), create the necessary containers for the application and PostgreSQL database, and start them in detached mode.
    ```bash
    docker-compose up --build -d

3.  **Verify the application is running:**
    You can check the logs of the application container:
    ```bash
    docker-compose logs app
    ```
    The application should be accessible at `http://localhost:5000` (or whatever port is configured in `docker-compose.yml` and `server.js`).

## API Endpoints
Detailed API endpoints, request/response formats, and authentication requirements can be found in the `docs/swagger.yaml` file. You can typically view this using a Swagger UI tool.

## Error Handling
The application implements a standard error handling mechanism. All operational errors are caught in controllers and passed to a centralized error middleware using `next(error)`. This middleware logs the error and formats a specific, user-friendly response with an appropriate HTTP status code and an internal error code. Unexpected errors are gracefully handled as generic server errors.

Custom error classes are defined in `utils/errors.js` for common scenarios like authentication failures, validation errors, duplicate data, record not found, database issues, file operations, and configuration problems.
