#!/bin/bash

# MCS (Metal Credit Score) Deployment Script
# India's First Asset-Backed Credit Scoring Engine
# 
# @author MiniMax Agent
# @version 1.0.0
# @date 2025-11-21

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="mcs-project"
NODE_VERSION="18"
MONGODB_VERSION="6.0"
REDIS_VERSION="7.0"

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_success "macOS detected"
    else
        print_error "Unsupported OS: $OSTYPE"
        exit 1
    fi
    
    # Check Node.js
    if command_exists node; then
        NODE_INSTALLED_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_INSTALLED_VERSION" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) is installed"
        else
            print_warning "Node.js version is too old. Please install Node.js $NODE_VERSION or higher"
            echo "Visit: https://nodejs.org/"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js $NODE_VERSION or higher"
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        print_success "npm $(npm -v) is installed"
    else
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check MongoDB
    if command_exists mongod; then
        print_success "MongoDB is installed"
    else
        print_warning "MongoDB is not installed. Please install MongoDB $MONGODB_VERSION or higher"
        echo "Visit: https://www.mongodb.com/try/download/community"
    fi
    
    # Check Redis
    if command_exists redis-server; then
        print_success "Redis is installed"
    else
        print_warning "Redis is not installed. Please install Redis $REDIS_VERSION or higher"
        echo "Visit: https://redis.io/download"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    # Navigate to project directory
    cd "$(dirname "$0")"
    
    # Install backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi
    
    # Install frontend dependencies (if needed)
    if [ -d "frontend" ]; then
        print_status "Frontend dependencies (if any)..."
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    fi
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment configuration..."
    
    # Create .env file
    if [ ! -f "backend/.env" ]; then
        print_status "Creating backend .env file..."
        cat > backend/.env << EOF
# MCS (Metal Credit Score) Environment Configuration
# Generated on $(date)

# Environment
NODE_ENV=production
PORT=3005

# Database
MONGODB_URI=mongodb://localhost:27017/mcs
REDIS_URL=redis://localhost:6379

# JWT Secret
JWT_SECRET=your-super-secure-jwt-secret-key-change-in-production

# API Keys for Asset Platforms
BGT_API_URL=http://localhost:3001/api
BST_API_URL=http://localhost:3002/api
BPT_API_URL=http://localhost:3003/api
BINR_API_URL=http://localhost:3004/api

BGT_API_TOKEN=your-bgt-api-token
BST_API_TOKEN=your-bst-api-token
BPT_API_TOKEN=your-bpt-api-token
BINR_API_TOKEN=your-binr-api-token

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Rate Limiting
RATE_LIMIT_MAX=200

# Logging
LOG_LEVEL=info

# MCS Specific
MCS_CACHE_DURATION=300000
MCS_BATCH_SIZE=10
MCS_MIN_SCORE=300
MCS_MAX_SCORE=900
EOF
        print_success "Backend .env file created"
    else
        print_warning "Backend .env file already exists"
    fi
    
    # Create frontend .env (if needed)
    if [ ! -f "frontend/.env" ]; then
        print_status "Creating frontend .env file..."
        cat > frontend/.env << EOF
# MCS Frontend Environment Configuration

VITE_API_BASE_URL=http://localhost:3005/api
VITE_WS_URL=ws://localhost:3005
VITE_APP_TITLE=MCS Dashboard
VITE_APP_VERSION=1.0.0
EOF
        print_success "Frontend .env file created"
    else
        print_warning "Frontend .env file already exists"
    fi
}

# Setup directories
setup_directories() {
    print_status "Setting up required directories..."
    
    # Create logs directory
    mkdir -p backend/logs
    print_success "Created backend/logs directory"
    
    # Create data directory
    mkdir -p data/{backups,exports}
    print_success "Created data directories"
    
    # Create certificates directory for HTTPS
    mkdir -p certificates
    print_success "Created certificates directory"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start MongoDB
    if command_exists mongod; then
        print_status "Starting MongoDB..."
        if pgrep -x "mongod" > /dev/null; then
            print_warning "MongoDB is already running"
        else
            mongod --fork --logpath /var/log/mongodb.log --dbpath /var/lib/mongodb || \
            mongod --fork --logpath ./mongodb.log --dbpath ./data/mongodb
            print_success "MongoDB started"
        fi
    fi
    
    # Start Redis
    if command_exists redis-server; then
        print_status "Starting Redis..."
        if pgrep -x "redis-server" > /dev/null; then
            print_warning "Redis is already running"
        else
            redis-server --daemonize yes --logfile ./redis.log || \
            redis-server &
            print_success "Redis started"
        fi
    fi
}

# Build frontend (if using build tools)
build_frontend() {
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        print_status "Building frontend for production..."
        cd frontend
        
        if grep -q '"build"' package.json; then
            npm run build
            print_success "Frontend built successfully"
        else
            print_warning "No build script found in frontend/package.json"
        fi
        
        cd ..
    fi
}

# Deploy application
deploy_application() {
    print_status "Deploying MCS application..."
    
    # Start the backend server
    if [ -f "backend/server.js" ]; then
        print_status "Starting MCS API server..."
        
        cd backend
        
        # Check if PM2 is available for production deployment
        if command_exists pm2; then
            print_status "Starting with PM2 for production..."
            pm2 start server.js --name "mcs-api" --env production
            print_success "MCS API server started with PM2"
        else
            print_warning "PM2 not found, starting with Node.js..."
            if [ "$NODE_ENV" = "production" ]; then
                nohup node server.js > ../logs/mcs-api.log 2>&1 &
            else
                node server.js &
            fi
            print_success "MCS API server started"
        fi
        
        cd ..
    fi
    
    # Start the frontend server
    if [ -d "frontend/dist" ] || [ -f "frontend/index.html" ]; then
        print_status "Starting frontend server..."
        
        if command_exists pm2 && [ -d "frontend/dist" ]; then
            cd frontend
            pm2 serve dist 8080 --name "mcs-frontend" --spa
            cd ..
            print_success "Frontend started with PM2"
        else
            # Simple file server for static files
            if command_exists python3; then
                cd frontend
                nohup python3 -m http.server 8080 > ../logs/frontend.log 2>&1 &
                cd ..
                print_success "Frontend started with Python HTTP server"
            elif command_exists python; then
                cd frontend
                nohup python -m SimpleHTTPServer 8080 > ../logs/frontend.log 2>&1 &
                cd ..
                print_success "Frontend started with Python HTTP server"
            else
                print_warning "No suitable HTTP server found for frontend"
            fi
        fi
    fi
}

# Health check
health_check() {
    print_status "Performing health checks..."
    
    sleep 5  # Wait for services to start
    
    # Check backend
    if curl -f -s http://localhost:3005/health > /dev/null; then
        print_success "MCS API server is healthy"
    else
        print_warning "MCS API server health check failed"
    fi
    
    # Check frontend
    if curl -f -s http://localhost:8080 > /dev/null; then
        print_success "Frontend is accessible"
    else
        print_warning "Frontend health check failed"
    fi
    
    # Check database connections
    if command_exists mongo; then
        if mongo --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
            print_success "MongoDB connection successful"
        else
            print_warning "MongoDB connection failed"
        fi
    fi
}

# Setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create monitoring script
    cat > scripts/monitor.sh << 'EOF'
#!/bin/bash
# MCS Monitoring Script

echo "=== MCS System Status ==="
echo "Timestamp: $(date)"
echo

# Check services
echo "Service Status:"
if pgrep -x "node" > /dev/null; then
    echo "✓ MCS API Server: Running"
else
    echo "✗ MCS API Server: Not running"
fi

if pgrep -x "python" > /dev/null; then
    echo "✓ Frontend Server: Running"
else
    echo "✗ Frontend Server: Not running"
fi

if pgrep -x "mongod" > /dev/null; then
    echo "✓ MongoDB: Running"
else
    echo "✗ MongoDB: Not running"
fi

if pgrep -x "redis-server" > /dev/null; then
    echo "✓ Redis: Running"
else
    echo "✗ Redis: Not running"
fi

echo
echo "API Health Check:"
if curl -f -s http://localhost:3005/health > /dev/null; then
    echo "✓ API Health: OK"
else
    echo "✗ API Health: Failed"
fi

echo
echo "System Resources:"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
EOF
    
    chmod +x scripts/monitor.sh
    print_success "Monitoring script created"
    
    # Create logs cleanup script
    cat > scripts/cleanup-logs.sh << 'EOF'
#!/bin/bash
# MCS Logs Cleanup Script

echo "Cleaning up old logs..."

# Keep only last 30 days of logs
find logs/ -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true

echo "Log cleanup completed"
EOF
    
    chmod +x scripts/cleanup-logs.sh
    print_success "Log cleanup script created"
}

# Generate SSL certificates (self-signed for development)
generate_certificates() {
    if [ ! -f "certificates/mcs.crt" ]; then
        print_status "Generating self-signed SSL certificates for development..."
        
        if command_exists openssl; then
            openssl req -x509 -newkey rsa:4096 -keyout certificates/mcs.key -out certificates/mcs.crt -days 365 -nodes -subj "/C=IN/ST=MH/L=Mumbai/O=MCS/OU=IT/CN=localhost"
            print_success "SSL certificates generated"
        else
            print_warning "OpenSSL not found. Skipping SSL certificate generation"
        fi
    else
        print_warning "SSL certificates already exist"
    fi
}

# Print deployment summary
print_summary() {
    print_success "======================================"
    print_success "   MCS Deployment Complete!           "
    print_success "======================================"
    echo
    echo "🌟 MCS (Metal Credit Score) is now running:"
    echo
    echo "📊 Dashboard:     http://localhost:8080"
    echo "🔌 API Server:    http://localhost:3005"
    echo "🗄️  MongoDB:      localhost:27017"
    echo "⚡ Redis:         localhost:6379"
    echo
    echo "🔑 Default Credentials:"
    echo "   Username: admin@nbfc.com"
    echo "   Password: admin123"
    echo
    echo "📖 Documentation:"
    echo "   API Docs: http://localhost:3005/api-docs"
    echo "   Health:   http://localhost:3005/health"
    echo
    echo "🛠️  Management Commands:"
    echo "   Monitor:  ./scripts/monitor.sh"
    echo "   Logs:     tail -f logs/mcs-api.log"
    echo "   Status:   curl http://localhost:3005/health"
    echo
    echo "🚀 Next Steps:"
    echo "   1. Update .env files with production values"
    echo "   2. Configure asset platform API endpoints"
    echo "   3. Set up proper SSL certificates"
    echo "   4. Configure monitoring and backups"
    echo
    print_success "Happy scoring! 🎯"
}

# Main deployment function
main() {
    echo "======================================"
    echo "   MCS Deployment Script              "
    echo "   Metal Credit Score (MCS) v1.0.0    "
    echo "   India's First Asset-Backed Credit  "
    echo "   Scoring Engine                     "
    echo "======================================"
    echo
    
    # Run deployment steps
    check_requirements
    install_dependencies
    setup_environment
    setup_directories
    start_services
    build_frontend
    deploy_application
    health_check
    setup_monitoring
    generate_certificates
    
    # Print summary
    print_summary
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "dev"|"development")
        print_status "Deploying in development mode..."
        export NODE_ENV=development
        main
        ;;
    "prod"|"production")
        print_status "Deploying in production mode..."
        export NODE_ENV=production
        main
        ;;
    "health")
        health_check
        ;;
    "monitor")
        if [ -f "scripts/monitor.sh" ]; then
            ./scripts/monitor.sh
        else
            print_error "Monitoring script not found. Run deploy first."
        fi
        ;;
    "cleanup")
        print_status "Cleaning up old logs..."
        if [ -f "scripts/cleanup-logs.sh" ]; then
            ./scripts/cleanup-logs.sh
        else
            find logs/ -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true
            print_success "Log cleanup completed"
        fi
        ;;
    "stop")
        print_status "Stopping MCS services..."
        pkill -f "node server.js" 2>/dev/null || true
        pkill -f "python.*http.server" 2>/dev/null || true
        pm2 delete mcs-api mcs-frontend 2>/dev/null || true
        print_success "Services stopped"
        ;;
    "restart")
        $0 stop
        sleep 2
        $0
        ;;
    *)
        echo "Usage: $0 {deploy|dev|prod|health|monitor|cleanup|stop|restart}"
        echo
        echo "Commands:"
        echo "  deploy     - Full deployment (default)"
        echo "  dev        - Deploy in development mode"
        echo "  prod       - Deploy in production mode"
        echo "  health     - Check system health"
        echo "  monitor    - Show system status"
        echo "  cleanup    - Clean up old logs"
        echo "  stop       - Stop all services"
        echo "  restart    - Restart all services"
        exit 1
        ;;
esac