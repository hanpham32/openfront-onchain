#!/bin/bash
# deploy.sh - Deploy application to Hetzner server
# This script:
# 1. Copies the update script to Hetzner server
# 2. Executes the update script on the Hetzner server

set -e # Exit immediately if a command exits with a non-zero status

# Initialize variables
ENABLE_BASIC_AUTH=false

# Parse command line arguments
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --enable_basic_auth)
            ENABLE_BASIC_AUTH=true
            shift
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

# Restore positional parameters
set -- "${POSITIONAL_ARGS[@]}"

# Function to print section headers
print_header() {
    echo "======================================================"
    echo "🚀 $1"
    echo "======================================================"
}

# Check command line arguments
if [ $# -ne 4 ]; then
    echo "Error: Please specify environment, host, version tag, and subdomain"
    echo "Usage: $0 [prod|staging] [eu|nbg1|staging|masters] [version_tag] [subdomain] [--enable_basic_auth]"
    exit 1
fi

# Validate first argument (environment)
if [ "$1" != "prod" ] && [ "$1" != "staging" ]; then
    echo "Error: First argument must be either 'prod' or 'staging'"
    echo "Usage: $0 [prod|staging] [eu|nbg1|staging|masters] [version_tag] [subdomain] [--enable_basic_auth]"
    exit 1
fi

# Validate second argument (host)
if [ "$2" != "eu" ] && [ "$2" != "nbg1" ] && [ "$2" != "staging" ] && [ "$2" != "masters" ]; then
    echo "Error: Second argument must be either 'eu', 'nbg1', 'staging', or 'masters'"
    echo "Usage: $0 [prod|staging] [eu|nbg1|staging|masters] [version_tag] [subdomain] [--enable_basic_auth]"
    exit 1
fi

ENV=$1
HOST=$2
VERSION_TAG=$3
SUBDOMAIN=$4

# Set subdomain - use the provided subdomain
echo "Using subdomain: $SUBDOMAIN"

# Load common environment variables first
if [ -f .env ]; then
    echo "Loading common configuration from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Load environment-specific variables
if [ -f .env.$ENV ]; then
    echo "Loading $ENV-specific configuration from .env.$ENV file..."
    export $(grep -v '^#' .env.$ENV | xargs)
fi

# Check required environment variables for deployment
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_REPO" ]; then
    echo "Error: DOCKER_USERNAME or DOCKER_REPO not defined in .env file or environment"
    exit 1
fi

if [[ "$VERSION_TAG" == sha256:* ]]; then
    DOCKER_IMAGE="${DOCKER_USERNAME}/${DOCKER_REPO}@${VERSION_TAG}"
else
    DOCKER_IMAGE="${DOCKER_USERNAME}/${DOCKER_REPO}:${VERSION_TAG}"
fi

if [ "$HOST" == "staging" ]; then
    print_header "DEPLOYING TO STAGING HOST"
    SERVER_HOST=$SERVER_HOST_STAGING
elif [ "$HOST" == "nbg1" ]; then
    print_header "DEPLOYING TO NBG1 HOST"
    SERVER_HOST=$SERVER_HOST_NBG1
elif [ "$HOST" == "masters" ]; then
    print_header "DEPLOYING TO MASTERS HOST"
    SERVER_HOST=$SERVER_HOST_MASTERS
else
    print_header "DEPLOYING TO EU HOST"
    SERVER_HOST=$SERVER_HOST_EU
fi

# Check required environment variables
if [ -z "$SERVER_HOST" ]; then
    echo "Error: ${HOST} not defined in .env file or environment"
    exit 1
fi

# Check if basic auth is enabled and credentials are available
if [ "$ENABLE_BASIC_AUTH" = true ]; then
    print_header "BASIC AUTH ENABLED"
    if [ -z "$BASIC_AUTH_USER" ] || [ -z "$BASIC_AUTH_PASS" ]; then
        echo "Error: Basic Auth is enabled but BASIC_AUTH_USER or BASIC_AUTH_PASS not defined in .env file or environment"
        exit 1
    fi
    echo "Basic Authentication will be enabled with user: $BASIC_AUTH_USER"
else
    # If basic auth is not enabled, set the variables to empty to ensure they don't get used
    BASIC_AUTH_USER=""
    BASIC_AUTH_PASS=""
    echo "Basic Authentication is disabled"
fi

# Configuration
UPDATE_SCRIPT="./update.sh" # Path to your update script
REMOTE_USER="openfront"
REMOTE_UPDATE_PATH="/home/$REMOTE_USER"
REMOTE_UPDATE_SCRIPT="$REMOTE_UPDATE_PATH/update-openfront.sh" # Where to place the script on server

# Check if update script exists
if [ ! -f "$UPDATE_SCRIPT" ]; then
    echo "Error: Update script $UPDATE_SCRIPT not found!"
    exit 1
fi

# Display deployment information
print_header "DEPLOYMENT INFORMATION"
echo "Environment: ${ENV}"
echo "Host: ${HOST}"
echo "Subdomain: ${SUBDOMAIN}"
echo "Docker Image: $DOCKER_IMAGE"
echo "Target Server: $SERVER_HOST"

# Copy update script to Hetzner server
print_header "COPYING UPDATE SCRIPT TO SERVER"
echo "Target: $REMOTE_USER@$SERVER_HOST"

# Make sure the update script is executable
chmod +x $UPDATE_SCRIPT

# Copy the update script to the server
scp -i $SSH_KEY $UPDATE_SCRIPT $REMOTE_USER@$SERVER_HOST:$REMOTE_UPDATE_SCRIPT

if [ $? -ne 0 ]; then
    echo "❌ Failed to copy update script to server. Stopping deployment."
    exit 1
fi

# Generate a random filename for the environment file to prevent conflicts
# when multiple deployments are happening at the same time.
ENV_FILE="${REMOTE_UPDATE_PATH}/${SUBDOMAIN}-${RANDOM}.env"

print_header "EXECUTING UPDATE SCRIPT ON SERVER"

ssh -i $SSH_KEY $REMOTE_USER@$SERVER_HOST "chmod +x $REMOTE_UPDATE_SCRIPT && \
cat > $ENV_FILE << 'EOL'
GAME_ENV=$ENV
ENV=$ENV
HOST=$HOST
DOCKER_IMAGE=$DOCKER_IMAGE
DOCKER_TOKEN=$DOCKER_TOKEN
ADMIN_TOKEN=$ADMIN_TOKEN
CF_ACCOUNT_ID=$CF_ACCOUNT_ID
R2_ACCESS_KEY=$R2_ACCESS_KEY
R2_SECRET_KEY=$R2_SECRET_KEY
R2_BUCKET=$R2_BUCKET
CF_API_TOKEN=$CF_API_TOKEN
DOMAIN=$DOMAIN
SUBDOMAIN=$SUBDOMAIN
OTEL_USERNAME=$OTEL_USERNAME
OTEL_PASSWORD=$OTEL_PASSWORD
OTEL_ENDPOINT=$OTEL_ENDPOINT
OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_AUTH_HEADER=$OTEL_AUTH_HEADER
BASIC_AUTH_USER=$BASIC_AUTH_USER
BASIC_AUTH_PASS=$BASIC_AUTH_PASS
EOL
chmod 600 $ENV_FILE && \
$REMOTE_UPDATE_SCRIPT $ENV_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to execute update script on server."
    exit 1
fi

print_header "DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "✅ New version deployed to ${ENV} environment in ${HOST} with subdomain ${SUBDOMAIN}!"
if [ "$ENABLE_BASIC_AUTH" = true ]; then
    echo "🔒 Basic authentication enabled with user: $BASIC_AUTH_USER"
fi
echo "🌐 Check your server to verify the deployment."
echo "======================================================="
