# TEMS Call Flow Analyzer

A modern web application developed to analyze TEMS log files and visualize call flows with 3GPP paging animations.

## Features

### 📊 Call Flow Analysis
- **Visual Call Flow Diagram**: Step-by-step visualization of message flows
- **Paging Operations**: Display paging messages with special visual effects
- **Timing Analysis**: Calculate time intervals between messages
- **Error Detection**: Automatic error message detection and highlighting

### 🔍 Advanced Filtering
- **Protocol Filter**: Paging, Call Setup, Handover, Location Update, Authentication, SMS
- **Message Type Filter**: Request, Response, Indication, Complete
- **Source/Destination Filter**: View communication between specific nodes
- **Time Range Filter**: Display messages within specific time periods

### 📈 Statistics and Reporting
- **Real-time Statistics**: Message counts, protocol distribution
- **Error Analysis**: Detailed analysis of detected errors
- **Performance Metrics**: Response times and system performance
- **CSV Export**: Export filtered data

### 🎨 Modern Interface
- **Responsive Design**: Mobile and desktop compatible
- **Dark/Light Theme**: User preference
- **Zoom Controls**: Zoom in/out diagrams
- **Interactive Elements**: View message details

## Installation

### Requirements
- Python 3.8+
- pip (Python package manager)

### Step 1: Clone the Project
```bash
git clone <repository-url>
cd LogViewer
```

### Step 2: Create Virtual Environment (Recommended)
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Start the Application
```bash
python app.py
```

The application will start running at `http://localhost:8080`.

## Usage

### 1. Upload Log File
- Select your `.log` or `.txt` file from the "Upload Log File" section in the left panel
- Click the "Upload and Analyze" button
- The system will automatically parse and analyze the file

### 2. Examine Call Flow Diagram
- View the message flow in the **Call Flow Diagram** tab
- Each step is numbered and color-coded:
  - 🔵 **Blue**: Paging messages with special animations
  - 🟢 **Green**: Call Setup messages
  - 🟡 **Yellow**: Handover messages
  - 🔴 **Red**: Error messages
- Use zoom controls to zoom in/out the diagram
- Click on any step to view its details

### 3. Filter Messages
- Use filter options in the left panel:
  - **Protocol Type**: Show only specific protocol messages
  - **Message Type**: Filter Request, Response, etc. types
  - **Source/Destination**: View communication between specific nodes
- Click "Apply Filters" button
- Use "Clear Filters" to remove all filters

### 4. Detailed Message List
- View all messages in table format in the **Message List** tab
- Click on any row to open message details
- Use "Export" button to download filtered data in CSV format

### 5. Analysis Results
- In the **Analysis Results** tab:
  - **Timing Analysis**: Total duration and average response times
  - **Error Analysis**: Detected errors and explanations
  - **System Recommendations**: Performance improvement suggestions

## Supported Log Formats

The application supports the following TEMS log formats:

```
2024-01-15 10:30:25.123 PAGING Request From: BSC_001 To: MSC_001
2024-01-15 10:30:25.145 PAGING Response From: MSC_001 To: BSC_001
2024-01-15 10:30:25.200 CALL_SETUP Request From: MSC_001 To: BSC_001
```

### Automatically Recognized Fields:
- **Timestamp**: `YYYY-MM-DD HH:MM:SS.mmm` format
- **Protocol Type**: PAGING, CALL_SETUP, HANDOVER, LOCATION_UPDATE, AUTH, SMS
- **Message Type**: Request, Response, Indication, Complete, Challenge, Deliver
- **Source/Destination**: From:/To: fields
- **Transaction ID**: TID, TransactionId, Transaction_ID
- **Parameters**: IMSI, TMSI, LAI, CI, MSISDN, MCC, MNC, LAC, CellId

## 3GPP Paging Animations

The application features special visual effects for 3GPP paging messages:

### S1-AP Paging
- **Visual Effect**: Ripple animation from MME to eNB
- **Color**: Blue gradient with expanding circles
- **Duration**: 2 seconds

### RRC Paging (Broadcast)
- **Visual Effect**: Broadcasting animation from eNB
- **Color**: Purple gradient with radiating waves
- **Duration**: 3 seconds

### RRC Paging Response
- **Visual Effect**: Response animation from UE to eNB
- **Color**: Green gradient with directional flow
- **Duration**: 1.5 seconds

## Technical Details

### Project Structure
```
LogViewer/
├── app.py                 # Main Flask application
├── tems_parser.py         # Log parsing and analysis module
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # CSS styles with 3GPP animations
│   └── js/
│       └── app.js        # JavaScript application
└── uploads/              # Temporary file upload directory
```

### API Endpoints
- `GET /` - Main page
- `POST /upload` - Log file upload
- `POST /api/analyze` - Call flow analysis
- `POST /api/filter` - Message filtering

### Technologies
- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6
- **Animations**: CSS3 Keyframes for 3GPP paging effects

## Development

### Debug Mode
```bash
export FLASK_ENV=development
python app.py
```

### Adding New Features
1. `tems_parser.py` - New parsing logic
2. `app.py` - New API endpoints
3. `static/js/app.js` - Frontend functionality
4. `templates/index.html` - UI elements
5. `static/css/style.css` - Animation effects

## Troubleshooting

### Common Issues

**1. File not uploading**
- Ensure file format is `.log` or `.txt`
- Check file size is less than 50MB
- Verify file encoding is UTF-8

**2. Messages not parsing**
- Check log format matches supported format
- Verify timestamp format is correct
- Check console for error messages

**3. Performance issues**
- Use filtering for large files
- Clear browser cache
- Reduce zoom level

**4. Paging animations not visible**
- Check browser console for JavaScript errors
- Ensure log contains paging messages
- Verify message format includes "PAGING" keyword

### Log Levels
- **INFO**: Normal operation logs
- **WARNING**: Warning messages
- **ERROR**: Error messages
- **DEBUG**: Detailed debug information

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Contact

For questions:
- Use GitHub Issues
- Email: [your-email@example.com]

---

**Note**: This application is developed to analyze TEMS log files with 3GPP paging visualizations. Test in a controlled environment before using in production network operations.