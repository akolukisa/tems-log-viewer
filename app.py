from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime
from tems_parser import TemsParser

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Initialize the Tems parser
tems_parser = TemsParser()

@app.route('/')
def index():
    """Ana sayfa - call flow analiz arayüzü"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Tems log dosyasını yükle ve parse et"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Dosya seçilmedi'}), 400
        
        # Desteklenen dosya uzantıları
        allowed_extensions = ['.log', '.txt', '.trp']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file and file_extension in allowed_extensions:
            # Dosyayı geçici olarak kaydet
            filename = f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_extension}"
            filepath = os.path.join('uploads', filename)
            
            # uploads klasörünü oluştur
            os.makedirs('uploads', exist_ok=True)
            file.save(filepath)
            
            # Parse et
            parsed_data = tems_parser.parse_log_file(filepath)
            
            # Geçici dosyayı sil
            os.remove(filepath)
            
            return jsonify({
                'success': True,
                'data': parsed_data,
                'message': f'{file_extension.upper()} dosyası başarıyla parse edildi'
            })
        else:
            return jsonify({'error': 'Sadece .log, .txt ve .trp dosyaları destekleniyor'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Dosya işlenirken hata oluştu: {str(e)}'}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_call_flow():
    """Call flow analizi yap"""
    try:
        data = request.get_json()
        log_data = data.get('log_data', [])
        
        # Call flow analizi
        analysis = tems_parser.analyze_call_flow(log_data)
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
        
    except Exception as e:
        return jsonify({'error': f'Analiz sırasında hata oluştu: {str(e)}'}), 500

@app.route('/api/filter', methods=['POST'])
def filter_messages():
    """Mesajları filtrele"""
    try:
        data = request.get_json()
        log_data = data.get('log_data', [])
        filters = data.get('filters', {})
        
        filtered_data = tems_parser.filter_messages(log_data, filters)
        
        return jsonify({
            'success': True,
            'filtered_data': filtered_data
        })
        
    except Exception as e:
        return jsonify({'error': f'Filtreleme sırasında hata oluştu: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)