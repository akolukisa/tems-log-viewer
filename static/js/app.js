// Tems Call Flow Analyzer - Ana JavaScript Dosyası

class TemsAnalyzer {
    constructor() {
        this.currentData = null;
        this.filteredData = null;
        this.currentZoom = 1;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeComponents();
        this.initializeSimulation();
        this.initEnbMmeNavigation();
    }

    bindEvents() {
        // Dosya yükleme
        document.getElementById('uploadBtn').addEventListener('click', () => this.uploadFile());
        
        // Filtreler
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());
        
        // Zoom kontrolleri
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());
        
        // Export
        document.getElementById('exportMessages').addEventListener('click', () => this.exportMessages());
        
        // Tab değişimi
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => this.onTabChange(e.target.getAttribute('data-bs-target')));
        });
    }

    initializeComponents() {
        // Bootstrap tooltips
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Alert container oluştur veya bul
        let alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            alertContainer.className = 'position-fixed top-0 end-0 p-3';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        alertContainer.innerHTML = alertHtml;
        
        // 5 saniye sonra otomatik kapat
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }

    async uploadFile() {
        const fileInput = document.getElementById('logFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showAlert('Lütfen bir log dosyası seçin.', 'warning');
            return;
        }
        
        const allowedExtensions = ['.log', '.txt', '.trp'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!allowedExtensions.includes(fileExtension)) {
            this.showAlert('Sadece .log, .txt ve .trp dosyaları destekleniyor.', 'danger');
            return;
        }
        
        this.showLoading();
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentData = result.data;
                this.filteredData = result.data.messages;
                this.updateUI();
                this.updateSimulationMessageList();
                this.showAlert('Log dosyası başarıyla yüklendi ve analiz edildi.', 'success');
            } else {
                this.showAlert(result.error || 'Dosya yüklenirken hata oluştu.', 'danger');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showAlert('Dosya yüklenirken hata oluştu: ' + error.message, 'danger');
        } finally {
            this.hideLoading();
        }
    }

    updateUI() {
        if (!this.currentData) return;
        
        this.updateStatistics();
        this.updateFlowDiagram();
        this.updateMessagesList();
        this.updateAnalysis();
        this.findEnbMmeMessages();
    }

    updateStatistics() {
        const stats = this.currentData.statistics;
        const statsHtml = `
            <div class="row">
                <div class="col-12 mb-2">
                    <div class="stat-card info">
                        <div class="stat-number">${stats.total_messages}</div>
                        <div class="stat-label">Toplam Mesaj</div>
                    </div>
                </div>
                <div class="col-12 mb-2">
                    <div class="stat-card success">
                        <div class="stat-number">${stats.paging_messages || 0}</div>
                        <div class="stat-label">Paging Mesajı</div>
                    </div>
                </div>
                <div class="col-12 mb-2">
                    <div class="stat-card warning">
                        <div class="stat-number">${stats.connection_messages || 0}</div>
                        <div class="stat-label">Bağlantı Mesajı</div>
                    </div>
                </div>
                <div class="col-12 mb-2">
                    <div class="stat-card" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);">
                        <div class="stat-number">${stats.measurement_messages || 0}</div>
                        <div class="stat-label">Ölçüm Mesajı</div>
                    </div>
                </div>
            </div>
            <hr>
            <h6>Protokol Dağılımı:</h6>
            ${stats.protocols ? Object.entries(stats.protocols).map(([protocol, count]) => `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge protocol-badge protocol-${protocol.toLowerCase().replace(' ', '-')}">${protocol}</span>
                    <span class="fw-bold">${count}</span>
                </div>
            `).join('') : '<p>Protokol bilgisi bulunamadı</p>'}
        `;
        
        document.getElementById('statisticsPanel').innerHTML = statsHtml;
    }

    updateFlowDiagram() {
        const messages = this.filteredData || this.currentData.messages;
        const diagramHtml = this.generateFlowDiagram(messages);
        document.getElementById('flowDiagram').innerHTML = diagramHtml;
        
        // Flow step'lere click event ekle
        document.querySelectorAll('.flow-step').forEach(step => {
            step.addEventListener('click', (e) => {
                const messageId = e.currentTarget.dataset.messageId;
                this.showMessageDetail(messageId);
            });
            
            // Hover efekti ekle
            step.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            
            step.addEventListener('mouseleave', (e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
            });
        });
    }

    generateFlowDiagram(messages) {
        if (!messages || messages.length === 0) {
            return `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-info-circle fa-3x mb-3"></i>
                    <h5>Mesaj bulunamadı</h5>
                    <p>Seçilen filtrelere uygun mesaj bulunamadı.</p>
                </div>
            `;
        }
        
        let html = '<div class="flow-diagram">';
        
        messages.forEach((message, index) => {
            const protocol = message.protocol || message.protocol_type || 'unknown';
            const protocolClass = this.getProtocolClass(protocol);
            const messageType = (message.message_type || 'unknown').toLowerCase().replace(/[\s_\-]/g, '');
            const isError = (message.raw_content && message.raw_content.toLowerCase().includes('error')) || 
                           (message.message_type && message.message_type.toLowerCase().includes('error'));
            
            // Mesaj tipi sınıfını belirle
            let messageTypeClass = `msg-${messageType}`;
            if (isError) {
                messageTypeClass += ' error';
            }
            
            // Özel mesaj türleri için sınıf belirleme
            let specialClass = '';
            if (message.message_type) {
                const msgType = message.message_type.toLowerCase();
                if (msgType.includes('paging')) {
                    specialClass = 'paging';
                } else if (msgType.includes('connection') && (msgType.includes('setup') || msgType.includes('request'))) {
                    specialClass = 'call-setup';
                } else if (msgType.includes('handover')) {
                    specialClass = 'handover';
                }
            }
            
            // Yön belirleyici ikon
            const direction = message.parameters?.direction || '';
            let directionIcon = '';
            if (direction.includes('Uplink')) {
                directionIcon = '<i class="fas fa-arrow-up text-success me-2" title="Uplink"></i>';
            } else if (direction.includes('Downlink')) {
                directionIcon = '<i class="fas fa-arrow-down text-primary me-2" title="Downlink"></i>';
            }
            
            html += `
                <div class="flow-step ${protocolClass} ${messageTypeClass} ${specialClass}" data-message-id="${message.id}" onclick="temsAnalyzer.showMessageDetail(${message.id})">
                    <div class="flow-step-number">
                        ${index + 1}
                    </div>
                    <div class="flow-step-content">
                        <div class="flow-step-title">
                            ${directionIcon}
                            <span>${message.message_type || 'N/A'}</span>
                            ${message.parameters?.purpose ? `<i class="fas fa-info-circle text-muted ms-2" title="${message.parameters.purpose}"></i>` : ''}
                        </div>
                        <div class="flow-step-details">
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                ${message.parameters?.channel ? `<span class="badge bg-secondary" style="font-size: 0.7rem;">${message.parameters.channel}</span>` : ''}
                                ${message.pci ? `<span class="badge bg-info" style="font-size: 0.7rem;">PCI: ${message.pci}</span>` : ''}
                                ${message.earfcn ? `<span class="badge bg-success" style="font-size: 0.7rem;">EARFCN: ${message.earfcn}</span>` : ''}
                                ${message.rrc_transaction_id ? `<span class="badge bg-warning text-dark" style="font-size: 0.7rem;">TxID: ${message.rrc_transaction_id}</span>` : ''}
                                ${isError ? '<span class="badge bg-danger" style="font-size: 0.7rem;"><i class="fas fa-exclamation-triangle me-1"></i>Error</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flow-step-time">
                        <i class="fas fa-clock me-1"></i>
                        ${this.formatTime(message.timestamp)}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    getProtocolClass(protocol) {
        const classMap = {
            'Paging': 'paging',
            'Call Setup': 'call-setup',
            'Handover': 'handover',
            'Location Update': 'location-update',
            'Authentication': 'authentication',
            'SMS': 'sms'
        };
        return classMap[protocol] || 'other';
    }

    formatTime(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('tr-TR', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                fractionalSecondDigits: 3
            });
        } catch {
            return timestamp;
        }
    }

    updateMessagesList() {
        const messages = this.filteredData || this.currentData.messages;
        const tbody = document.querySelector('#messagesTable tbody');
        
        if (!messages || messages.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        Gösterilecek mesaj bulunamadı.
                    </td>
                </tr>
            `;
            return;
        }
        
        const rows = messages.map(message => `
            <tr data-message-id="${message.id}" style="cursor: pointer;">
                <td>${message.id}</td>
                <td>${this.formatTime(message.timestamp)}</td>
                <td>
                    <span class="badge protocol-badge protocol-${(message.protocol || 'unknown').toLowerCase().replace(' ', '-')}">
                        ${message.protocol || 'N/A'}
                    </span>
                </td>
                <td>
                    <span class="badge channel-badge channel-${(message.channel || 'unknown').toLowerCase()}">
                        ${message.channel || 'N/A'}
                    </span>
                </td>
                <td>
                    <span class="badge msg-${(message.message_type || 'unknown').toLowerCase()}">
                        ${message.message_type || 'N/A'}
                    </span>
                </td>
                <td>${message.pci || '-'}</td>
                <td>${message.earfcn || '-'}</td>
                <td>${message.rsrp ? message.rsrp + ' dBm' : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="temsAnalyzer.showMessageDetail(${message.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        tbody.innerHTML = rows;
        
        // Satırlara click event ekle
        tbody.querySelectorAll('tr[data-message-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
                    const messageId = row.dataset.messageId;
                    this.showMessageDetail(messageId);
                }
            });
        });
    }

    async updateAnalysis() {
        if (!this.currentData) return;
        
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    log_data: this.currentData.messages
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayAnalysisResults(result.analysis);
            }
        } catch (error) {
            console.error('Analysis error:', error);
        }
    }

    displayAnalysisResults(analysis) {
        // Timing analizi
        const timingHtml = `
            <div class="mb-3">
                <h6>Toplam Süre</h6>
                <p class="text-muted">${analysis.timing_analysis.total_duration ? 
                    (analysis.timing_analysis.total_duration / 1000).toFixed(2) + ' saniye' : 
                    'Hesaplanamadı'}</p>
            </div>
            <div class="mb-3">
                <h6>Ortalama Yanıt Süresi</h6>
                <p class="text-muted">${analysis.timing_analysis.average_response_time ? 
                    analysis.timing_analysis.average_response_time.toFixed(2) + ' ms' : 
                    'Hesaplanamadı'}</p>
            </div>
        `;
        document.getElementById('timingAnalysis').innerHTML = timingHtml;
        
        // Hata analizi
        const errorHtml = analysis.error_analysis.length > 0 ? 
            analysis.error_analysis.map(error => `
                <div class="alert alert-danger" role="alert">
                    <strong>${error.type}:</strong> ${error.description}<br>
                    <small class="text-muted">Zaman: ${this.formatTime(error.timestamp)}</small>
                </div>
            `).join('') : 
            '<p class="text-success"><i class="fas fa-check-circle me-2"></i>Hata tespit edilmedi.</p>';
        document.getElementById('errorAnalysis').innerHTML = errorHtml;
        
        // Öneriler
        const recommendationsHtml = analysis.recommendations.length > 0 ?
            analysis.recommendations.map(rec => `
                <div class="alert alert-info" role="alert">
                    <i class="fas fa-lightbulb me-2"></i>${rec}
                </div>
            `).join('') :
            '<p class="text-muted">Şu anda öneri bulunmuyor.</p>';
        document.getElementById('recommendations').innerHTML = recommendationsHtml;
    }

    showMessageDetail(messageId) {
        const messages = this.filteredData || this.currentData.messages;
        const message = messages.find(m => m.id == messageId);
        if (!message) return;
        
        const protocol = message.protocol || message.protocol_type || 'Unknown';
        const messageType = message.message_type || 'N/A';
        const params = message.parameters || {};
        
        const modalContent = `
            <div class="row">
                <div class="col-md-6">
                    <h6><i class="fas fa-info-circle me-2"></i>Temel Bilgiler</h6>
                    <table class="table table-sm table-striped">
                        <tr><td><strong>ID:</strong></td><td>${message.id}</td></tr>
                        <tr><td><strong>Zaman:</strong></td><td>${this.formatTime(message.timestamp)}</td></tr>
                        <tr><td><strong>Protokol:</strong></td><td>
                            <span class="badge protocol-badge protocol-${protocol.toLowerCase().replace(/[\s_]/g, '-')}">
                                ${protocol}
                            </span>
                        </td></tr>
                        <tr><td><strong>Mesaj Tipi:</strong></td><td>
                            <span class="badge msg-${messageType.toLowerCase().replace(/[\s_]/g, '-')}">
                                ${messageType}
                            </span>
                        </td></tr>
                        ${message.message_identity ? `<tr><td><strong>Mesaj Kimliği:</strong></td><td>${message.message_identity}</td></tr>` : ''}
                        ${params.layer3_message ? `<tr><td><strong>Layer 3 Message:</strong></td><td>${params.layer3_message}</td></tr>` : ''}
                        ${params.protocol_detail ? `<tr><td><strong>Protocol Detail:</strong></td><td>${params.protocol_detail}</td></tr>` : ''}
                        ${params.channel_detail || message.channel ? `<tr><td><strong>Kanal:</strong></td><td>${params.channel_detail || message.channel}</td></tr>` : ''}
                        ${params.lte_rrc_version ? `<tr><td><strong>LTE RRC Version:</strong></td><td>${params.lte_rrc_version}</td></tr>` : ''}
                        ${params.nr_rrc_version ? `<tr><td><strong>NR 5G RRC Version:</strong></td><td>${params.nr_rrc_version}</td></tr>` : ''}
                        ${message.rrc_transaction_id ? `<tr><td><strong>RRC Transaction ID:</strong></td><td>${message.rrc_transaction_id}</td></tr>` : ''}
                        ${message.pci ? `<tr><td><strong>PCI:</strong></td><td>${message.pci}</td></tr>` : ''}
                        ${message.earfcn ? `<tr><td><strong>EARFCN:</strong></td><td>${message.earfcn}</td></tr>` : ''}
                        ${params.rb_id ? `<tr><td><strong>RB Id:</strong></td><td>${params.rb_id}</td></tr>` : ''}
                        ${params.subfn ? `<tr><td><strong>SubFN:</strong></td><td>${params.subfn}</td></tr>` : ''}
                        ${params.sysfn ? `<tr><td><strong>SysFN:</strong></td><td>${params.sysfn}</td></tr>` : ''}
                        ${message.rsrp ? `<tr><td><strong>RSRP:</strong></td><td>${message.rsrp} dBm</td></tr>` : ''}
                    </table>
                    
                    ${params.purpose || params.direction || params.content_structure ? `
                        <h6 class="mt-4"><i class="fas fa-clipboard-list me-2"></i>Mesaj Detayları</h6>
                        <div class="card border-primary">
                            <div class="card-body p-3">
                                ${params.purpose ? `
                                    <div class="mb-3">
                                        <strong class="text-primary"><i class="fas fa-bullseye me-1"></i>Amaç:</strong>
                                        <p class="mb-0 mt-1 text-muted">${params.purpose}</p>
                                    </div>
                                ` : ''}
                                ${params.direction ? `
                                    <div class="mb-3">
                                        <strong class="text-success"><i class="fas fa-exchange-alt me-1"></i>Yön:</strong>
                                        <span class="badge bg-success ms-2">${params.direction}</span>
                                    </div>
                                ` : ''}
                                ${params.content_structure ? `
                                    <div class="mb-0">
                                        <strong class="text-info"><i class="fas fa-sitemap me-1"></i>İçerik Yapısı:</strong>
                                        <p class="mb-0 mt-1 text-muted small">${params.content_structure}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="col-md-6">
                    <h6><i class="fas fa-list me-2"></i>Events & Parametreler</h6>
                    <div class="parameters-container" style="max-height: 300px; overflow-y: auto;">
                        ${params.events ? `
                            <div class="mb-3 p-2 bg-info bg-opacity-10 rounded border border-info">
                                <strong class="text-info"><i class="fas fa-calendar-alt me-1"></i>Events:</strong>
                                <pre class="mt-2 mb-0" style="font-size: 0.8rem; white-space: pre-wrap;">${params.events}</pre>
                            </div>
                        ` : ''}
                        ${message.parameters && Object.keys(message.parameters).length > 0 ? 
                            Object.entries(message.parameters)
                                .filter(([key]) => !['events', 'layer3_message', 'protocol_detail', 'channel_detail', 'lte_rrc_version', 'nr_rrc_version', 'rb_id', 'subfn', 'sysfn'].includes(key))
                                .map(([key, value]) => 
                                    `<div class="mb-2 p-2 bg-light rounded">
                                        <strong class="text-primary">${key}:</strong>
                                        <div class="ms-2">${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</div>
                                    </div>`
                                ).join('') : 
                            '<p class="text-muted"><i class="fas fa-info-circle me-1"></i>Ek parametre bulunamadı.</p>'
                        }
                    </div>
                </div>
            </div>
            <hr>
            <div class="row">
                <div class="col-12">
                    <h6><i class="fas fa-code me-2"></i>Ham İçerik</h6>
                    <div class="position-relative">
                        <button class="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 mt-2 me-2" 
                                onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent)" 
                                title="Kopyala">
                            <i class="fas fa-copy"></i>
                        </button>
                        <pre class="bg-dark text-light p-3 rounded" style="max-height: 400px; overflow-y: auto; font-size: 0.875rem; font-family: 'Courier New', monospace;">${message.raw_content || 'İçerik bulunamadı.'}</pre>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('messageDetailContent').innerHTML = modalContent;
        
        // Mevcut modal instance'ını temizle
        const modalElement = document.getElementById('messageDetailModal');
        const existingModal = bootstrap.Modal.getInstance(modalElement);
        if (existingModal) {
            existingModal.dispose();
        }
        
        // Yeni modal instance oluştur
        const modal = new bootstrap.Modal(modalElement);
        
        // Modal kapatıldığında temizlik yap
        modalElement.addEventListener('hidden.bs.modal', function() {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.dispose();
            }
        }, { once: true });
        
        modal.show();
    }

    async applyFilters() {
        if (!this.currentData) {
            this.showAlert('Önce bir log dosyası yükleyin.', 'warning');
            return;
        }
        
        const filters = {
            protocol: document.getElementById('protocolFilter').value,
            channel: document.getElementById('channelFilter').value,
            message_type: document.getElementById('messageTypeFilter').value,
            message_direction: document.getElementById('messageDirectionFilter').value,
            message_identity: document.getElementById('messageIdentityFilter').value,
            pci: document.getElementById('pciFilter').value,
            earfcn: document.getElementById('earfcnFilter').value,
            min_rsrp: document.getElementById('minRsrpFilter').value,
            max_rsrp: document.getElementById('maxRsrpFilter').value,
            rrc_transaction_id: document.getElementById('rrcTransactionFilter').value
        };
        
        // Checkbox filtreler
        if (document.getElementById('pagingOnlyFilter').checked) {
            filters.is_paging = true;
        }
        if (document.getElementById('measurementOnlyFilter').checked) {
            filters.is_measurement = true;
        }
        if (document.getElementById('connectionOnlyFilter').checked) {
            filters.is_connection_related = true;
        }
        
        // Boş filtreleri temizle
        Object.keys(filters).forEach(key => {
            if (!filters[key] && filters[key] !== false) delete filters[key];
        });
        
        try {
            const response = await fetch('/api/filter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    log_data: this.currentData.messages,
                    filters: filters
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.filteredData = result.filtered_data;
                this.updateFlowDiagram();
                this.updateMessagesList();
                this.showAlert(`${result.filtered_data.length} mesaj filtrelendi.`, 'info');
            }
        } catch (error) {
            console.error('Filter error:', error);
            this.showAlert('Filtreleme sırasında hata oluştu.', 'danger');
        }
    }

    clearFilters() {
        document.getElementById('protocolFilter').value = '';
        document.getElementById('channelFilter').value = '';
        document.getElementById('messageTypeFilter').value = '';
        document.getElementById('messageDirectionFilter').value = '';
        document.getElementById('messageIdentityFilter').value = '';
        document.getElementById('pciFilter').value = '';
        document.getElementById('earfcnFilter').value = '';
        document.getElementById('minRsrpFilter').value = '';
        document.getElementById('maxRsrpFilter').value = '';
        document.getElementById('rrcTransactionFilter').value = '';
        document.getElementById('pagingOnlyFilter').checked = false;
        document.getElementById('measurementOnlyFilter').checked = false;
        document.getElementById('connectionOnlyFilter').checked = false;
        
        if (this.currentData) {
            this.filteredData = this.currentData.messages;
            this.updateFlowDiagram();
            this.updateMessagesList();
            this.showAlert('Filtreler temizlendi.', 'info');
        }
    }

    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom * 1.25, 2);
        this.applyZoom();
    }

    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom * 0.8, 0.5);
        this.applyZoom();
    }

    resetZoom() {
        this.currentZoom = 1;
        this.applyZoom();
    }

    applyZoom() {
        const diagram = document.getElementById('flowDiagram');
        diagram.style.transform = `scale(${this.currentZoom})`;
        diagram.style.transformOrigin = 'top left';
    }

    exportMessages() {
        if (!this.filteredData && !this.currentData) {
            this.showAlert('Dışa aktarılacak veri bulunamadı.', 'warning');
            return;
        }
        
        const messages = this.filteredData || this.currentData.messages;
        const csvContent = this.convertToCSV(messages);
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `tems_messages_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showAlert('Mesajlar CSV formatında dışa aktarıldı.', 'success');
    }

    convertToCSV(messages) {
        const headers = ['ID', 'Timestamp', 'Protocol', 'Message Type', 'Source', 'Destination', 'Transaction ID'];
        const rows = messages.map(msg => [
            msg.id,
            msg.timestamp,
            msg.protocol_type,
            msg.message_type,
            msg.source || '',
            msg.destination || '',
            msg.transaction_id || ''
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    onTabChange(target) {
        // Tab değiştiğinde gerekli güncellemeleri yap
        if (target === '#protocol' && this.currentData) {
            this.updateProtocolLayers();
        } else if (target === '#sequence' && this.currentData && this.currentData.messages.length > 0) {
            this.updateMessageSequence();
        }
    }

    updateProtocolLayers() {
        if (!this.currentData || !this.currentData.messages) return;
        
        const messages = this.filteredData || this.currentData.messages;
        const protocolStats = {
            RRC: [],
            'S1-AP': [],
            NAS: []
        };
        
        // Mesajları protokol türüne göre grupla
        messages.forEach(message => {
            if (message.protocol_type && protocolStats[message.protocol_type]) {
                protocolStats[message.protocol_type].push(message);
            }
        });
        
        // RRC mesajlarını göster
        this.displayProtocolMessages('rrcMessages', protocolStats.RRC, 'RRC');
        
        // S1-AP mesajlarını göster
        this.displayProtocolMessages('s1apMessages', protocolStats['S1-AP'], 'S1-AP');
        
        // NAS mesajlarını göster
        this.displayProtocolMessages('nasMessages', protocolStats.NAS, 'NAS');
        
        // Protokol grafiğini güncelle
        this.updateProtocolChart(protocolStats);
    }
    
    displayProtocolMessages(containerId, messages, protocolType) {
        const container = document.getElementById(containerId);
        if (!messages || messages.length === 0) {
            container.innerHTML = `<p class="text-muted">${protocolType} mesajı bulunamadı</p>`;
            return;
        }
        
        const messageTypes = {};
        messages.forEach(msg => {
            const type = msg.message_type || 'Bilinmeyen';
            messageTypes[type] = (messageTypes[type] || 0) + 1;
        });
        
        let html = '<div class="protocol-message-list">';
        Object.entries(messageTypes).forEach(([type, count]) => {
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <span class="fw-bold">${type}</span>
                    <span class="badge bg-secondary">${count}</span>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    updateProtocolChart(protocolStats) {
        const ctx = document.getElementById('protocolChart');
        if (!ctx) return;
        
        const data = {
            labels: ['RRC', 'S1-AP', 'NAS'],
            datasets: [{
                data: [
                    protocolStats.RRC.length,
                    protocolStats['S1-AP'].length,
                    protocolStats.NAS.length
                ],
                backgroundColor: ['#0d6efd', '#198754', '#ffc107'],
                borderWidth: 1
            }]
        };
        
        if (this.protocolChart) {
            this.protocolChart.destroy();
        }
        
        this.protocolChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    updateMessageSequence() {
        if (!this.currentData || !this.currentData.messages) return;
        
        const messages = this.filteredData || this.currentData.messages;
        const sequenceList = document.getElementById('sequenceList');
        
        if (messages.length === 0) {
            sequenceList.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-list-ol fa-3x mb-3"></i>
                    <p>Filtrelenmiş mesaj bulunamadı.</p>
                </div>
            `;
            return;
        }
        
        // İstatistikleri güncelle
        this.updateSequenceStatistics(messages);
        
        // Mesaj listesini oluştur
        let html = '<div class="sequence-items">';
        messages.forEach((message, index) => {
            const directionIcon = this.getDirectionIcon(message.direction);
            const protocolBadge = this.getProtocolBadge(message.protocol_type);
            
            html += `
                <div class="sequence-item border rounded p-3 mb-2" data-message-id="${message.id}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <span class="sequence-number badge bg-primary me-2">${index + 1}</span>
                                <span class="direction-icon me-2">${directionIcon}</span>
                                ${protocolBadge}
                                <span class="message-type fw-bold ms-2">${message.message_type || 'Bilinmeyen'}</span>
                            </div>
                            <div class="message-details text-muted small">
                                <span class="timestamp">${this.formatTime(message.timestamp)}</span>
                                <span class="mx-2">•</span>
                                <span class="channel">${message.channel || 'N/A'}</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="temsAnalyzer.showMessageDetail('${message.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        sequenceList.innerHTML = html;
        
        // Sıralama butonlarını bağla
        this.bindSequenceSortButtons();
    }
    
    updateSequenceStatistics(messages) {
        const stats = {
            rrc: 0,
            s1ap: 0,
            nas: 0,
            uplink: 0,
            downlink: 0
        };
        
        messages.forEach(message => {
            // Protokol sayıları
            if (message.protocol_type === 'RRC') stats.rrc++;
            else if (message.protocol_type === 'S1-AP') stats.s1ap++;
            else if (message.protocol_type === 'NAS') stats.nas++;
            
            // Yön sayıları
            if (message.direction === 'uplink') stats.uplink++;
            else if (message.direction === 'downlink') stats.downlink++;
        });
        
        // DOM'u güncelle
        document.getElementById('rrcCount').textContent = stats.rrc;
        document.getElementById('s1apCount').textContent = stats.s1ap;
        document.getElementById('nasCount').textContent = stats.nas;
        document.getElementById('uplinkCount').textContent = stats.uplink;
        document.getElementById('downlinkCount').textContent = stats.downlink;
    }
    
    getDirectionIcon(direction) {
        switch(direction) {
            case 'uplink': return '<i class="fas fa-arrow-up text-info"></i>';
            case 'downlink': return '<i class="fas fa-arrow-down text-secondary"></i>';
            default: return '<i class="fas fa-question text-muted"></i>';
        }
    }
    
    getProtocolBadge(protocol) {
        switch(protocol) {
            case 'RRC': return '<span class="badge bg-primary">RRC</span>';
            case 'S1-AP': return '<span class="badge bg-success">S1-AP</span>';
            case 'NAS': return '<span class="badge bg-warning text-dark">NAS</span>';
            default: return '<span class="badge bg-secondary">Bilinmeyen</span>';
        }
    }
    
    bindSequenceSortButtons() {
        document.getElementById('sortByTime')?.addEventListener('click', () => {
            this.sortSequenceBy('time');
        });
        
        document.getElementById('sortByProtocol')?.addEventListener('click', () => {
            this.sortSequenceBy('protocol');
        });
        
        document.getElementById('sortByDirection')?.addEventListener('click', () => {
            this.sortSequenceBy('direction');
        });
    }
    
    sortSequenceBy(criteria) {
        if (!this.currentData || !this.currentData.messages) return;
        
        let messages = [...(this.filteredData || this.currentData.messages)];
        
        switch(criteria) {
            case 'time':
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                break;
            case 'protocol':
                messages.sort((a, b) => (a.protocol_type || '').localeCompare(b.protocol_type || ''));
                break;
            case 'direction':
                messages.sort((a, b) => (a.direction || '').localeCompare(b.direction || ''));
                break;
        }
        
        // Geçici olarak sıralanmış veriyi kullan
        const originalFiltered = this.filteredData;
        this.filteredData = messages;
        this.updateMessageSequence();
        this.filteredData = originalFiltered;
    }
    
    updateTimeline() {
        const container = document.getElementById('timelineContainer');
        if (!this.currentData || !this.currentData.messages || this.currentData.messages.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-upload fa-3x mb-3"></i>
                    <p>Log dosyası yüklendiğinde timeline burada görünecek.</p>
                </div>
            `;
            return;
        }

        const messages = this.filteredData || this.currentData.messages;

        // Zaman aralığını hesapla
        const times = messages.map(msg => new Date(msg.timestamp).getTime()).sort((a, b) => a - b);
        const startTime = times[0];
        const endTime = times[times.length - 1];
        const duration = endTime - startTime;

        if (duration === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <p>Tüm mesajlar aynı zamanda gönderilmiş.</p>
                </div>
            `;
            return;
        }

        // Timeline HTML'i oluştur
        let timelineHTML = `
            <div class="timeline">
                <div class="timeline-axis"></div>
        `;

        // Zaman etiketleri ekle
        const tickCount = 10;
        for (let i = 0; i <= tickCount; i++) {
            const tickTime = startTime + (duration * i / tickCount);
            const position = (i / tickCount) * 100;
            const timeLabel = this.formatTime(new Date(tickTime).toISOString());
            
            timelineHTML += `
                <div class="timeline-tick" style="left: ${position}%"></div>
                <div class="timeline-label" style="left: ${position}%">${timeLabel}</div>
            `;
        }

        // Mesaj eventlerini ekle
         messages.forEach((message, index) => {
             const messageTime = new Date(message.timestamp).getTime();
             const position = ((messageTime - startTime) / duration) * 100;
             const protocol = message.protocol || message.protocol_type || 'unknown';
             const protocolClass = this.getProtocolClass(protocol);
             const isError = (message.message_type && message.message_type.toLowerCase().includes('error')) ||
                            (message.raw_content && message.raw_content.toLowerCase().includes('error'));
             
             timelineHTML += `
                 <div class="timeline-event ${protocolClass} ${isError ? 'error' : ''}" 
                      style="left: ${position}%" 
                      data-message-id="${message.id}"
                      onclick="temsAnalyzer.showMessageDetail(${message.id})">
                     <div class="timeline-tooltip">
                         <strong>${protocol}</strong><br>
                         ${message.message_type || 'N/A'}<br>
                         ${this.formatTime(message.timestamp)}
                     </div>
                 </div>
             `;
         });

        timelineHTML += '</div>';
        container.innerHTML = timelineHTML;

        // Timeline zoom kontrollerini bağla
        this.bindTimelineEvents();
    }

    // eNB-MME mesajları için navigasyon
    initEnbMmeNavigation() {
        this.enbMmeMessages = [];
        this.currentEnbMmeIndex = -1;
        
        const nextBtn = document.getElementById('nextEnbMmeBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.navigateToNextEnbMmeMessage();
            });
        }

    }

    findEnbMmeMessages() {
        const messages = this.filteredData || this.currentData.messages;
        if (!messages) return;

        this.enbMmeMessages = messages.filter(message => {
            const protocol = (message.protocol || '').toLowerCase();
            const messageType = (message.message_type || '').toLowerCase();
            const direction = (message.parameters?.direction || '').toLowerCase();
            
            // S1-AP mesajları veya eNB-MME arası mesajlar
            return protocol.includes('s1ap') || 
                   messageType.includes('initial context') ||
                   messageType.includes('ue context') ||
                   messageType.includes('handover') ||
                   (protocol.includes('nas') && (direction.includes('uplink') || direction.includes('downlink')));
        });
        
        this.currentEnbMmeIndex = -1;
        
        // Buton durumunu güncelle
        const nextBtn = document.getElementById('nextEnbMmeBtn');
        if (nextBtn) {
            nextBtn.disabled = this.enbMmeMessages.length === 0;
            nextBtn.title = this.enbMmeMessages.length > 0 ? 
                `${this.enbMmeMessages.length} eNB-MME mesajı bulundu` : 
                'eNB-MME mesajı bulunamadı';
        }
    }

    navigateToNextEnbMmeMessage() {
        if (this.enbMmeMessages.length === 0) {
            this.showAlert('eNB-MME arası mesaj bulunamadı.', 'warning');
            return;
        }
        
        this.currentEnbMmeIndex = (this.currentEnbMmeIndex + 1) % this.enbMmeMessages.length;
        const message = this.enbMmeMessages[this.currentEnbMmeIndex];
        
        // Simülasyonu bu mesajdan başlat
        const messageIndex = (this.filteredData || this.currentData.messages).indexOf(message);
        if (messageIndex !== -1) {
            this.startSimulationFromMessage(messageIndex);
            this.showAlert(`eNB-MME mesajı ${this.currentEnbMmeIndex + 1}/${this.enbMmeMessages.length}: ${message.message_type}`, 'info');
        }
    }

    startSimulationFromMessage(messageIndex) {
        // Simülasyon sekmesine geç
        const simulationTab = document.querySelector('[data-bs-target="#simulation"]');
        if (simulationTab) {
            const tab = new bootstrap.Tab(simulationTab);
            tab.show();
        }
        
        // Mesaj seçimini güncelle
        const startMessageSelect = document.getElementById('startMessageSelect');
        if (startMessageSelect) {
            startMessageSelect.value = messageIndex;
            this.selectStartMessage(messageIndex);
        }
        
        // Simülasyonu başlat
        setTimeout(() => {
            this.playSimulation();
        }, 500);
    }



    bindTimelineEvents() {
        const zoomInBtn = document.getElementById('timelineZoomIn');
        const zoomOutBtn = document.getElementById('timelineZoomOut');
        const resetBtn = document.getElementById('timelineReset');
        const timeline = document.querySelector('.timeline');

        if (zoomInBtn && timeline) {
            zoomInBtn.onclick = () => {
                const currentScale = parseFloat(timeline.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
                const newScale = Math.min(currentScale * 1.25, 3);
                timeline.style.transform = `scaleX(${newScale})`;
                timeline.style.transformOrigin = 'left center';
            };
        }

        if (zoomOutBtn && timeline) {
            zoomOutBtn.onclick = () => {
                const currentScale = parseFloat(timeline.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
                const newScale = Math.max(currentScale / 1.25, 0.5);
                timeline.style.transform = `scaleX(${newScale})`;
                timeline.style.transformOrigin = 'left center';
            };
        }

        if (resetBtn && timeline) {
            resetBtn.onclick = () => {
                timeline.style.transform = 'scaleX(1)';
            };
        }
    }

    // Call Flow Simulation Methods
    initializeSimulation() {
        this.simulationState = {
            isPlaying: false,
            isPaused: false,
            currentIndex: 0,
            messages: [],
            speed: 5,
            intervalId: null,
            startIndex: 0
        };

        this.bindSimulationEvents();
    }

    bindSimulationEvents() {
        // Simulation controls
        document.getElementById('playSimulation')?.addEventListener('click', () => {
            this.playSimulation();
        });

        document.getElementById('pauseSimulation')?.addEventListener('click', () => {
            this.pauseSimulation();
        });
        
        document.getElementById('resumeSimulation')?.addEventListener('click', () => {
            this.playSimulation();
        });

        document.getElementById('stepSimulation')?.addEventListener('click', () => {
            this.stepSimulation();
        });

        document.getElementById('resetSimulation')?.addEventListener('click', () => {
            this.resetSimulation();
        });

        document.getElementById('simulationSpeed')?.addEventListener('change', (e) => {
            this.simulationState.speed = parseFloat(e.target.value);
        });

        document.getElementById('startMessageSelect')?.addEventListener('change', (e) => {
            this.selectStartMessage(parseInt(e.target.value));
        });
    }

    updateSimulationMessageList() {
        const select = document.getElementById('startMessageSelect');
        if (!select || !this.currentData) return;

        select.innerHTML = '<option value="">Mesaj seçin...</option>';
        
        this.currentData.messages.forEach((message, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${index + 1}. ${this.formatTime(message.timestamp)} - ${message.message_type || 'Unknown'}`;
            select.appendChild(option);
        });

        document.getElementById('totalMessages').textContent = this.currentData.messages.length;
        
        // Otomatik olarak ilk mesajı seç
        if (this.currentData.messages.length > 0) {
            select.value = '0';
            this.selectStartMessage(0);
        }
    }

    selectStartMessage(startIndex) {
        if (!this.currentData || startIndex < 0) return;

        this.simulationState.messages = this.currentData.messages.slice(startIndex);
        this.simulationState.currentIndex = 0;
        this.simulationState.startIndex = startIndex; // Başlangıç index'ini kaydet
        this.updateSimulationStatus();
        this.resetSimulationCanvas();
    }

    async playSimulation() {
        if (!this.simulationState.messages.length) {
            this.showAlert('Önce bir başlangıç mesajı seçin.', 'warning');
            return;
        }

        // Ekranı hemen temizle
        this.resetSimulationCanvas();
        this.hideCurrentMessageDetails();

        this.simulationState.isPlaying = true;
        this.simulationState.isPaused = false;
        this.updateSimulationControls();
        this.updateSimulationStatus('Oynatılıyor');

        // Sıralı animasyon için async/await kullan
        await this.playSequentialAnimation();
    }

    pauseSimulation() {
        this.simulationState.isPlaying = false;
        this.simulationState.isPaused = true;
        this.updateSimulationControls();
        this.updateSimulationStatus('Duraklatıldı');

        if (this.simulationState.intervalId) {
            clearInterval(this.simulationState.intervalId);
            this.simulationState.intervalId = null;
        }
    }

    async playSequentialAnimation() {
        while (this.simulationState.currentIndex < this.simulationState.messages.length && this.simulationState.isPlaying) {
            const currentMessage = this.simulationState.messages[this.simulationState.currentIndex];
            if (!currentMessage) break;

            // Her mesajın animasyonunu bekle
            await this.animateMessage(currentMessage, this.simulationState.currentIndex);
            this.showCurrentMessageDetails(currentMessage);
            this.simulationState.currentIndex++;
            this.updateSimulationStatus();

            // Hız ayarına göre bekleme süresi
            const speed = 2000 - (this.simulationState.speed * 150);
            await this.delay(speed);
        }

        if (this.simulationState.currentIndex >= this.simulationState.messages.length) {
            this.stopSimulation();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stepSimulation() {
        if (!this.simulationState.messages.length) return;

        const currentMessage = this.simulationState.messages[this.simulationState.currentIndex];
        if (!currentMessage) {
            this.stopSimulation();
            return;
        }

        this.animateMessage(currentMessage, this.simulationState.currentIndex);
        this.showCurrentMessageDetails(currentMessage);
        this.simulationState.currentIndex++;
        this.updateSimulationStatus();

        if (this.simulationState.currentIndex >= this.simulationState.messages.length) {
            this.stopSimulation();
        }
    }

    resetSimulation() {
        this.stopSimulation();
        this.simulationState.currentIndex = 0;
        this.updateSimulationStatus('Hazır');
        this.resetSimulationCanvas();
        this.hideCurrentMessageDetails();
    }

    stopSimulation() {
        this.simulationState.isPlaying = false;
        this.simulationState.isPaused = false;
        this.updateSimulationControls();
        this.updateSimulationStatus('Tamamlandı');

        if (this.simulationState.intervalId) {
            clearInterval(this.simulationState.intervalId);
            this.simulationState.intervalId = null;
        }
    }

    updateSimulationControls() {
        const playBtn = document.getElementById('playSimulation');
        const pauseBtn = document.getElementById('pauseSimulation');
        const resumeBtn = document.getElementById('resumeSimulation');
        const stepBtn = document.getElementById('stepSimulation');
        const resetBtn = document.getElementById('resetSimulation');
        
        if (this.simulationState.isPlaying) {
            // Oynatılıyor durumu
            if (playBtn) playBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (stepBtn) stepBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = false;
        } else if (this.simulationState.isPaused) {
            // Duraklatılmış durumu
            if (playBtn) playBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-block';
            if (stepBtn) stepBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
        } else {
            // Durdurulmuş durumu
            if (playBtn) playBtn.style.display = 'inline-block';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (stepBtn) stepBtn.disabled = false;
            if (resetBtn) resetBtn.disabled = false;
        }
    }

    updateSimulationStatus(status = null) {
        const statusElement = document.getElementById('simulationStatus');
        const currentIndexElement = document.getElementById('currentMessageIndex');

        if (status) {
            statusElement.textContent = status;
            statusElement.className = 'badge ' + this.getStatusBadgeClass(status);
        }

        // Gerçek mesaj numarasını göster (başlangıç index'i + mevcut index + 1)
        const realMessageNumber = (this.simulationState.startIndex || 0) + this.simulationState.currentIndex + 1;
        currentIndexElement.textContent = realMessageNumber;
    }

    getStatusBadgeClass(status) {
        switch (status) {
            case 'Oynatılıyor': return 'bg-success';
            case 'Duraklatıldı': return 'bg-warning';
            case 'Tamamlandı': return 'bg-info';
            default: return 'bg-secondary';
        }
    }

    animateMessage(message, index) {
        return new Promise((resolve) => {
            const canvas = document.getElementById('simulationCanvas');
            const messageType = message.message_type || 'Unknown';
            
            // Protokol katmanlarını highlight et
            this.highlightProtocolLayers(message);
            
            // Mesaj akışı animasyonu
            this.createMessageFlow(canvas, message, index, resolve);
        });
    }

    highlightProtocolLayers(message) {
        // Protokol katmanlarını temizle
        document.querySelectorAll('.protocol-layer').forEach(layer => {
            layer.classList.remove('active');
        });
        
        if (!message) return;
        
        const protocol = message.protocol?.toLowerCase() || '';
        const messageType = message.message_type?.toLowerCase() || '';
        const content = message.content?.toLowerCase() || '';
        
        // Protokol katmanlarını belirle ve highlight et
        const layers = [];
        
        // NAS katmanı kontrolü
        if (protocol.includes('nas') || messageType.includes('nas') || 
            content.includes('attach') || content.includes('authentication') || 
            content.includes('security') || content.includes('emm') || content.includes('esm')) {
            layers.push('nas');
        }
        
        // RRC katmanı kontrolü
        if (protocol.includes('rrc') || messageType.includes('rrc') || 
            content.includes('connection') || content.includes('setup') || 
            content.includes('reconfiguration') || content.includes('measurement')) {
            layers.push('rrc');
        }
        
        // PDCP katmanı kontrolü
        if (protocol.includes('pdcp') || messageType.includes('pdcp') || 
            content.includes('pdcp') || content.includes('compression') || 
            content.includes('ciphering')) {
            layers.push('pdcp');
        }
        
        // MAC katmanı kontrolü
        if (protocol.includes('mac') || messageType.includes('mac') || 
            content.includes('scheduling') || content.includes('harq') || 
            content.includes('random access')) {
            layers.push('mac');
        }
        
        // PHY katmanı kontrolü
        if (protocol.includes('phy') || messageType.includes('phy') || 
            content.includes('physical') || content.includes('channel') || 
            content.includes('signal')) {
            layers.push('phy');
        }
        
        // Eğer hiç katman bulunamazsa, varsayılan olarak RRC'yi highlight et
        if (layers.length === 0) {
            layers.push('rrc');
        }
        
        // Belirlenen katmanları highlight et
        layers.forEach(layerName => {
            const layerElement = document.querySelector(`[data-layer="${layerName}"]`);
            if (layerElement) {
                layerElement.classList.add('active');
            }
        });
        
        // 4 saniye sonra highlight'ı kaldır
        setTimeout(() => {
            document.querySelectorAll('.protocol-layer.active').forEach(layer => {
                layer.classList.remove('active');
            });
        }, 4000);
    }

    highlightLayerFlow(layerType, sourceEntity, targetEntity) {
        // Protokol renk haritası
        const protocolColors = {
            'nas': { bg: 'linear-gradient(135deg, #9b59b6, #8e44ad)', shadow: 'rgba(155, 89, 182, 0.5)' },
            'rrc': { bg: 'linear-gradient(135deg, #e74c3c, #c0392b)', shadow: 'rgba(231, 76, 60, 0.5)' },
            'pdcp': { bg: 'linear-gradient(135deg, #3498db, #2980b9)', shadow: 'rgba(52, 152, 219, 0.5)' },
            'rlc': { bg: 'linear-gradient(135deg, #f39c12, #e67e22)', shadow: 'rgba(243, 156, 18, 0.5)' },
            'mac': { bg: 'linear-gradient(135deg, #27ae60, #229954)', shadow: 'rgba(39, 174, 96, 0.5)' },
            'phy': { bg: 'linear-gradient(135deg, #34495e, #2c3e50)', shadow: 'rgba(52, 73, 94, 0.5)' },
            's1ap': { bg: 'linear-gradient(135deg, #16a085, #138d75)', shadow: 'rgba(22, 160, 133, 0.5)' },
            'sctp': { bg: 'linear-gradient(135deg, #8e44ad, #7d3c98)', shadow: 'rgba(142, 68, 173, 0.5)' },
            'ip': { bg: 'linear-gradient(135deg, #95a5a6, #7f8c8d)', shadow: 'rgba(149, 165, 166, 0.5)' }
        };

        // Kaynak entity'deki layer'ı highlight et
        const sourceLayers = document.querySelectorAll(`.layer.${layerType}.${sourceEntity}`);
        sourceLayers.forEach(layer => {
            layer.classList.add('active');
            if (protocolColors[layerType]) {
                layer.style.background = protocolColors[layerType].bg;
                layer.style.color = 'white';
                layer.style.boxShadow = `0 0 15px ${protocolColors[layerType].shadow}`;
                layer.style.transform = 'scale(1.05)';
                layer.style.fontWeight = 'bold';
            }
        });

        // Hedef entity'deki layer'ı highlight et (varsa)
        setTimeout(() => {
            const targetLayers = document.querySelectorAll(`.layer.${layerType}.${targetEntity}`);
            targetLayers.forEach(layer => {
                layer.classList.add('active');
                if (protocolColors[layerType]) {
                    layer.style.background = protocolColors[layerType].bg;
                    layer.style.color = 'white';
                    layer.style.boxShadow = `0 0 15px ${protocolColors[layerType].shadow}`;
                    layer.style.transform = 'scale(1.05)';
                    layer.style.fontWeight = 'bold';
                }
            });
        }, 500);

        // Alt katmanları da sırayla highlight et
        const layerOrder = ['nas', 'rrc', 'pdcp', 'rlc', 'mac', 'phy', 's1ap', 'sctp', 'ip'];
        const currentIndex = layerOrder.indexOf(layerType);
        
        if (currentIndex > -1) {
            // Alt katmanları 200ms aralıklarla highlight et
            for (let i = currentIndex + 1; i < layerOrder.length; i++) {
                setTimeout(() => {
                    const lowerLayers = document.querySelectorAll(`.layer.${layerOrder[i]}.${sourceEntity}`);
                    lowerLayers.forEach(layer => {
                        layer.classList.add('active');
                        const lowerLayerType = layerOrder[i];
                        if (protocolColors[lowerLayerType]) {
                            layer.style.background = protocolColors[lowerLayerType].bg;
                            layer.style.color = 'white';
                            layer.style.boxShadow = `0 0 10px ${protocolColors[lowerLayerType].shadow}`;
                            layer.style.transform = 'scale(1.02)';
                        }
                    });
                }, (i - currentIndex) * 200);
            }
        }
        
        // Protokol bilgi tooltip'i göster
        this.showProtocolInfo(layerType, sourceEntity, targetEntity);
    }

    animateInterfaces(sourceEntity, targetEntity) {
        // Air interface animasyonu
        if ((sourceEntity === 'ue' && targetEntity === 'enb') || (sourceEntity === 'enb' && targetEntity === 'ue')) {
            const airInterface = document.querySelector('.air-interface');
            if (airInterface) {
                airInterface.style.animation = 'interfacePulse 1s ease-in-out 3';
            }
        }

        // S1 interface animasyonu
        if ((sourceEntity === 'enb' && targetEntity === 'mme') || (sourceEntity === 'mme' && targetEntity === 'enb')) {
            const s1Interface = document.querySelector('.s1-interface');
            if (s1Interface) {
                s1Interface.style.animation = 'interfacePulse 1s ease-in-out 3';
            }
        }
    }

    stopInterfaceAnimations() {
        const airInterface = document.querySelector('.air-interface');
        const s1Interface = document.querySelector('.s1-interface');
        
        if (airInterface) airInterface.style.animation = '';
        if (s1Interface) s1Interface.style.animation = '';
    }
    
    showProtocolInfo(layerType, sourceEntity, targetEntity) {
        const infoDiv = document.querySelector('.protocol-info') || this.createProtocolInfoDiv();
        
        const protocolDescriptions = {
            'nas': 'Non-Access Stratum - Mobility Management ve Session Management',
            'rrc': 'Radio Resource Control - Bağlantı kurma ve yapılandırma',
            'pdcp': 'Packet Data Convergence Protocol - Veri sıkıştırma ve şifreleme',
            'rlc': 'Radio Link Control - Veri segmentasyonu ve yeniden iletim',
            'mac': 'Medium Access Control - Kaynak tahsisi ve çoklu erişim',
            'phy': 'Physical Layer - RF sinyalleri ve modülasyon',
            's1ap': 'S1 Application Protocol - S1 interface mesajları',
            'sctp': 'Stream Control Transmission Protocol - Güvenilir veri iletimi',
            'ip': 'Internet Protocol - Ağ katmanı routing'
        };
        
        const directionText = `${sourceEntity.toUpperCase()} → ${targetEntity.toUpperCase()}`;
        
        infoDiv.innerHTML = `
            <div class="protocol-badge ${layerType}">${layerType.toUpperCase()}</div>
            <div class="protocol-description">${protocolDescriptions[layerType] || 'Bilinmeyen protokol'}</div>
            <div class="direction-info">${directionText}</div>
        `;
        
        infoDiv.style.display = 'block';
        
        // 4 saniye sonra gizle
        setTimeout(() => {
            infoDiv.style.display = 'none';
        }, 4000);
    }
    
    createProtocolInfoDiv() {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'protocol-info';
        infoDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 15px 20px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 20;
            display: none;
            text-align: center;
            min-width: 300px;
            border: 2px solid rgba(255,255,255,0.1);
        `;
        
        document.querySelector('.simulation-canvas').appendChild(infoDiv);
        return infoDiv;
    }

    createMessageFlow(canvas, message, index, resolve = null) {
        const messageType = message.message_type || 'Unknown Message';
        const protocol = message.protocol || 'Unknown';
        const direction = message.parameters?.direction?.toLowerCase() || '';
        
        // Mesaj bubble'ı oluştur
        const messageDiv = document.createElement('div');
        let bubbleClasses = 'message-bubble';
        
        // Protokol tipine göre CSS sınıfı ekle
        if (protocol.toLowerCase().includes('nas')) {
            bubbleClasses += ' nas';
        } else if (protocol.toLowerCase().includes('s1ap')) {
            bubbleClasses += ' s1ap';
        }
        
        // Yön tipine göre CSS sınıfı ekle
        if (direction.includes('downlink') || direction.includes('dl')) {
            bubbleClasses += ' downlink';
        }
        
        messageDiv.className = bubbleClasses;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="direction-tag ${direction.includes('uplink') || direction.includes('ul') ? 'uplink' : 'downlink'}">
                    ${direction.includes('uplink') || direction.includes('ul') ? '↑ UL' : '↓ DL'}
                </span>
            </div>
            <div class="message-content">${messageType}</div>
        `;
        
        // Unknown yön kontrolü
        const isUnknownDirection = !direction || direction === '' || direction.toLowerCase() === 'unknown';
        
        // Unknown yön için UE'de kırmızı ünlem işareti oluştur
        if (isUnknownDirection) {
            const warningIcon = document.createElement('div');
            warningIcon.className = 'unknown-direction-warning';
            warningIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            warningIcon.style.cssText = `
                position: absolute;
                left: 50px;
                top: 50px;
                color: #dc3545;
                font-size: 24px;
                z-index: 20;
                animation: blinkWarning 1s infinite;
            `;
            canvas.appendChild(warningIcon);
            
            // 3 saniye sonra kaldır
            setTimeout(() => {
                if (warningIcon.parentNode) {
                    warningIcon.parentNode.removeChild(warningIcon);
                }
            }, 3000);
            
            // Unknown mesajlar için erken çıkış
            if (resolve) resolve();
            return;
        }
        
        // Mesaj yönüne göre pozisyon belirle
        let startX, endX, startY, endY;
        const canvasWidth = canvas.offsetWidth || 600;
        const canvasHeight = canvas.offsetHeight || 300;
        
        // Mesajları sıralı olarak göster - 10 satır aşağıya, sonra tekrar yukarıdan başla
        const rowIndex = index % 10;
        const yPosition = 80 + rowIndex * 50;
        
        // Protokol tipine göre mesaj yönlendirmesi
        const isNASMessage = protocol.toLowerCase().includes('nas') || 
                            messageType.toLowerCase().includes('service request') ||
                            messageType.toLowerCase().includes('attach') ||
                            messageType.toLowerCase().includes('authentication') ||
                            messageType.toLowerCase().includes('tracking area');
        
        const isS1APMessage = protocol.toLowerCase().includes('s1ap') ||
                             messageType.toLowerCase().includes('initial context') ||
                             messageType.toLowerCase().includes('ue context') ||
                             messageType.toLowerCase().includes('handover') ||
                             messageType.toLowerCase().includes('paging');
        
        const isPagingMessage = message.is_paging || messageType.toLowerCase().includes('paging');
        
        // Debug için log ekle
        console.log(`Mesaj: ${messageType}, Protokol: ${protocol}, Direction: ${direction}, isNAS: ${isNASMessage}, isS1AP: ${isS1APMessage}, isPaging: ${isPagingMessage}`);
        
        if (isPagingMessage || messageType.toLowerCase().includes('service request')) {
            // 3GPP TS 23.401 ve TS 36.413 standardına göre paging prosedürü
            if (protocol.toLowerCase().includes('s1ap')) {
                if (direction.includes('downlink') || direction.includes('dl')) {
                    // S1-AP Paging Request: MME -> eNB (TS 36.413)
                    startX = canvasWidth - 80;
                    endX = canvasWidth / 2;
                    startY = yPosition;
                    endY = yPosition;
                    console.log(`3GPP S1AP Paging Request: MME->eNB ${startX} -> ${endX}, Y: ${yPosition}`);
                } else {
                    // S1-AP Initial UE Message (Service Request): eNB -> MME
                    startX = canvasWidth / 2;
                    endX = canvasWidth - 80;
                    startY = yPosition;
                    endY = yPosition;
                    console.log(`3GPP S1AP Initial UE Message: eNB->MME ${startX} -> ${endX}, Y: ${yPosition}`);
                }
            } else if (protocol.toLowerCase().includes('rrc')) {
                if (direction.includes('downlink') || direction.includes('dl')) {
                    // RRC Paging: eNB, PCCH kanalında paging mesajını broadcast yapar
                    startX = canvasWidth / 2;
                    endX = 80; // Ana UE pozisyonu
                    startY = yPosition;
                    endY = yPosition;
                    
                    // Broadcast efekti için ek animasyonlar ekle
                    this.createPagingBroadcastEffect(canvas, canvasWidth / 2, yPosition, message);
                    console.log(`3GPP RRC Paging Broadcast: eNB->All UEs ${startX} -> broadcast, Y: ${yPosition}`);
                    // Normal arrow da çiziyoruz, ana UE'ye
                } else {
                    // RRC Paging Response: UE -> eNB
                    startX = 80;
                    endX = canvasWidth / 2;
                    startY = yPosition;
                    endY = yPosition;
                    console.log(`3GPP RRC Paging Response: UE->eNB ${startX} -> ${endX}, Y: ${yPosition}`);
                }
            } else if (protocol.toLowerCase().includes('nas') && messageType.toLowerCase().includes('service request')) {
                // NAS Service Request: UE -> MME (paging response)
                startX = 80;
                endX = canvasWidth - 80;
                startY = yPosition;
                endY = yPosition;
                console.log(`3GPP NAS Service Request: UE->MME ${startX} -> ${endX}, Y: ${yPosition}`);
            }
        } else if (isNASMessage) {
            // NAS mesajları: UE ile MME arasında (eNB üzerinden transparent)
            if (direction.includes('uplink') || direction.includes('ul')) {
                // UE'den MME'ye (soldan sağa)
                startX = 80;
                endX = canvasWidth - 80;
                startY = yPosition;
                endY = yPosition;
                console.log(`NAS UL: ${startX} -> ${endX}, Y: ${yPosition}`);
            } else {
                // MME'den UE'ye (sağdan sola)
                startX = canvasWidth - 80;
                endX = 80;
                startY = yPosition;
                endY = yPosition;
                console.log(`NAS DL: ${startX} -> ${endX}, Y: ${yPosition}`);
            }
        } else if (isS1APMessage) {
            // S1-AP mesajları: eNB ile MME arasında
            if (direction.includes('uplink') || direction.includes('ul')) {
                // eNB'den MME'ye (ortadan sağa)
                startX = canvasWidth / 2;
                endX = canvasWidth - 80;
                startY = yPosition;
                endY = yPosition;
                console.log(`S1AP UL: ${startX} -> ${endX}, Y: ${yPosition}`);
            } else {
                // MME'den eNB'ye (sağdan ortaya)
                startX = canvasWidth - 80;
                endX = canvasWidth / 2;
                startY = yPosition;
                endY = yPosition;
                console.log(`S1AP DL: ${startX} -> ${endX}, Y: ${yPosition}`);
            }
        } else {
            // RRC mesajları: UE ile eNB arasında
            if (direction.includes('uplink') || direction.includes('ul')) {
                // UE'den eNB'ye (soldan ortaya)
                startX = 80;
                endX = canvasWidth / 2;
                startY = yPosition;
                endY = yPosition;
            } else {
                // eNB'den UE'ye (ortadan sola)
                startX = canvasWidth / 2;
                endX = 80;
                startY = yPosition;
                endY = yPosition;
            }
        }
        
        // Başlangıç pozisyonu
        messageDiv.style.left = startX + 'px';
        messageDiv.style.top = startY + 'px';
        
        canvas.appendChild(messageDiv);
        
        // Mesaj kutucuğuna tıklama hassasiyeti için daha büyük tıklama alanı
        messageDiv.style.cursor = 'pointer';
        messageDiv.style.zIndex = '25';
        
        // Mesaj kutucuğuna tıklama event'i ekle
        messageDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.showMessageDetails(message, messageDiv);
        });
        
        // Ok animasyonu oluştur
        this.createMessageArrow(canvas, startX, endX, startY, endY, direction, message);
        
        // Animasyon başlat
        setTimeout(() => {
            messageDiv.classList.add('active');
            // Mesajı hedef pozisyona taşı
            messageDiv.style.left = endX + 'px';
            messageDiv.style.top = endY + 'px';
        }, 100);
        
        // Animasyon tamamlandığında resolve çağır
        setTimeout(() => {
            if (resolve) resolve();
        }, 3500); // Animasyon süresi
        
        // 6-7 mesaj sonra kaldır (yaklaşık 25-30 saniye)
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 28000);
    }

    createPagingBroadcastEffect(canvas, centerX, centerY, message) {
        // 3GPP standardına göre RRC Paging broadcast efekti
        // eNB'den tüm yönlere dalga şeklinde yayılım
        
        const broadcastRipple = document.createElement('div');
        broadcastRipple.className = 'paging-broadcast-ripple';
        broadcastRipple.style.cssText = `
            position: absolute;
            left: ${centerX - 20}px;
            top: ${centerY - 20}px;
            width: 40px;
            height: 40px;
            border: 3px solid #ff6b35;
            border-radius: 50%;
            background: rgba(255, 107, 53, 0.1);
            animation: pagingRipple 2s ease-out;
            z-index: 15;
        `;
        
        canvas.appendChild(broadcastRipple);
        
        // Paging mesajı için özel broadcast ikonları
        const directions = [
            { x: centerX - 100, y: centerY, label: 'UE1' },
            { x: centerX + 100, y: centerY, label: 'UE2' },
            { x: centerX, y: centerY - 60, label: 'UE3' },
            { x: centerX, y: centerY + 60, label: 'UE4' }
        ];
        
        directions.forEach((dir, index) => {
            setTimeout(() => {
                const broadcastArrow = document.createElement('div');
                broadcastArrow.className = 'paging-broadcast-arrow';
                broadcastArrow.innerHTML = '📡';
                broadcastArrow.style.cssText = `
                    position: absolute;
                    left: ${centerX}px;
                    top: ${centerY}px;
                    font-size: 16px;
                    z-index: 20;
                    animation: pagingBroadcastMove 1.5s ease-out forwards;
                    --target-x: ${dir.x}px;
                    --target-y: ${dir.y}px;
                `;
                
                canvas.appendChild(broadcastArrow);
                
                // UE pozisyonlarında paging alındı efekti
                setTimeout(() => {
                    const ueResponse = document.createElement('div');
                    ueResponse.className = 'ue-paging-received';
                    ueResponse.innerHTML = '📱';
                    ueResponse.style.cssText = `
                        position: absolute;
                        left: ${dir.x}px;
                        top: ${dir.y}px;
                        font-size: 20px;
                        z-index: 25;
                        animation: pagingReceived 1s ease-in-out;
                    `;
                    
                    canvas.appendChild(ueResponse);
                    
                    // 2 saniye sonra kaldır
                    setTimeout(() => {
                        if (ueResponse.parentNode) ueResponse.remove();
                    }, 2000);
                }, 1000);
                
                // Broadcast arrow'u 2 saniye sonra kaldır
                setTimeout(() => {
                    if (broadcastArrow.parentNode) broadcastArrow.remove();
                }, 2000);
            }, index * 200); // Sıralı broadcast
        });
        
        // Ripple efektini 3 saniye sonra kaldır
        setTimeout(() => {
            if (broadcastRipple.parentNode) broadcastRipple.remove();
        }, 3000);
    }

    createMessageArrow(canvas, startX, endX, startY, endY, direction, message) {
        const arrow = document.createElement('div');
        arrow.className = 'message-arrow';
        
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        const isUplink = direction.includes('uplink') || direction.includes('ul');
        const isMovingRight = endX > startX;
        
        // Failure mesajları için kırmızı renk kullan
        const isFailure = message && (message.message_type?.toLowerCase().includes('failure') || 
                                     message.message_type?.toLowerCase().includes('reject') ||
                                     message.message_type?.toLowerCase().includes('error'));
        
        let arrowColor;
        if (isFailure) {
            arrowColor = '#dc3545'; // Kırmızı
        } else {
            arrowColor = isUplink ? '#28a745' : '#007bff'; // Yeşil veya mavi
        }
        
        // Ok pozisyonu ve boyutu
        arrow.style.position = 'absolute';
        arrow.style.left = startX + 'px';
        arrow.style.top = (startY + 25) + 'px';
        arrow.style.width = '0px'; // Başlangıçta genişlik 0
        arrow.style.height = '3px';
        arrow.style.background = arrowColor;
        arrow.style.borderRadius = '2px';
        arrow.style.transformOrigin = 'left center';
        arrow.style.transform = `rotate(${angle}deg)`;
        arrow.style.zIndex = '5';
        arrow.style.opacity = '0';
        
        // Ok başı
        const arrowHead = document.createElement('div');
        arrowHead.className = 'arrow-head';
        arrowHead.style.position = 'absolute';
        arrowHead.style.top = '-4px';
        arrowHead.style.width = '0';
        arrowHead.style.height = '0';
        arrowHead.style.opacity = '0';
        
        if (isMovingRight) {
            // Sağa doğru hareket - ok başı sağda
            arrowHead.style.right = '-8px';
            arrowHead.style.borderLeft = `8px solid ${arrowColor}`;
            arrowHead.style.borderTop = '4px solid transparent';
            arrowHead.style.borderBottom = '4px solid transparent';
        } else {
            // Sola doğru hareket - ok başı solda
            arrowHead.style.left = '-8px';
            arrowHead.style.borderRight = `8px solid ${arrowColor}`;
            arrowHead.style.borderTop = '4px solid transparent';
            arrowHead.style.borderBottom = '4px solid transparent';
        }
        
        arrow.appendChild(arrowHead);
        canvas.appendChild(arrow);
        
        // Animasyon başlat
        setTimeout(() => {
            arrow.style.opacity = '1';
            arrow.style.transition = 'width 2s ease-in-out';
            arrow.style.width = length + 'px';
            
            // Ok başını animasyon sonunda göster
            setTimeout(() => {
                arrowHead.style.opacity = '1';
            }, 1800);
        }, 100);
        
        // 6-7 mesaj sonra kaldır (yaklaşık 25-30 saniye)
        setTimeout(() => {
            if (arrow.parentNode) {
                arrow.remove();
            }
        }, 28000);
    }

    resetSimulationCanvas() {
        const canvas = document.getElementById('simulationCanvas');
        const bubbles = canvas.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
    }

    showCurrentMessageDetails(message) {
        const detailsContainer = document.getElementById('currentMessageDetails');
        const contentContainer = document.getElementById('currentMessageContent');
        
        if (!detailsContainer || !contentContainer) return;

        const params = message.parameters || {};
        const protocol = message.protocol || 'Unknown';
        const messageType = message.message_type || 'Unknown';

        const content = `
            <div class="row">
                <div class="col-md-6">
                    <table class="table table-sm">
                        <tr><td><strong>Zaman:</strong></td><td>${this.formatTime(message.timestamp)}</td></tr>
                        <tr><td><strong>Protokol:</strong></td><td>
                            <span class="badge protocol-badge protocol-${protocol.toLowerCase().replace(/[\s_]/g, '-')}">
                                ${protocol}
                            </span>
                        </td></tr>
                        <tr><td><strong>Mesaj Tipi:</strong></td><td>
                            <span class="badge msg-${messageType.toLowerCase().replace(/[\s_]/g, '-')}">
                                ${messageType}
                            </span>
                        </td></tr>
                        ${message.pci ? `<tr><td><strong>PCI:</strong></td><td>${message.pci}</td></tr>` : ''}
                        ${message.earfcn ? `<tr><td><strong>EARFCN:</strong></td><td>${message.earfcn}</td></tr>` : ''}
                    </table>
                </div>
                <div class="col-md-6">
                    ${params.purpose ? `
                        <div class="mb-2">
                            <strong class="text-primary">Amaç:</strong>
                            <p class="mb-0 small text-muted">${params.purpose}</p>
                        </div>
                    ` : ''}
                    ${params.direction ? `
                        <div class="mb-2">
                            <strong class="text-success">Yön:</strong>
                            <span class="badge bg-success ms-2">${params.direction}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        contentContainer.innerHTML = content;
        detailsContainer.style.display = 'block';
    }

    showMessageDetails(message, messageElement) {
        // Mevcut detay popup'ını kaldır
        const existingPopup = document.querySelector('.message-detail-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Yeni popup oluştur
        const popup = document.createElement('div');
        popup.className = 'message-detail-popup';
        
        const messageType = message.message_type || 'Bilinmeyen Mesaj';
        const protocol = message.protocol || 'Bilinmeyen';
        const direction = message.parameters?.direction || 'Bilinmeyen';
        const timestamp = message.timestamp || 'Bilinmeyen';
        
        // Mesaj açıklaması oluştur
        const explanation = this.getMessageExplanation(message);
        
        popup.innerHTML = `
            <div class="popup-header">
                <h5>${messageType}</h5>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="popup-content">
                <div class="message-info">
                    <p><strong>Protokol:</strong> ${protocol}</p>
                    <p><strong>Yön:</strong> ${direction}</p>
                    <p><strong>Zaman:</strong> ${this.formatTime(timestamp)}</p>
                </div>
                <div class="message-explanation">
                    <h6>Açıklama:</h6>
                    <p>${explanation}</p>
                </div>
                ${message.parameters ? `
                    <div class="message-parameters">
                        <h6>Parametreler:</h6>
                        <pre>${JSON.stringify(message.parameters, null, 2)}</pre>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Popup'ı body'e ekle (fixed position için)
        document.body.appendChild(popup);
        
        // Popup pozisyonunu ayarla (viewport koordinatları)
        const rect = messageElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = rect.right + 10;
        let top = rect.top;
        
        // Popup'ın sağ tarafta yer kalmazsa sol tarafa koy
        if (left + 350 > viewportWidth) {
            left = rect.left - 360;
        }
        
        // Popup'ın alt tarafta yer kalmazsa yukarı kaydır
        if (top + 300 > viewportHeight) {
            top = viewportHeight - 310;
        }
        
        // Minimum pozisyon kontrolü
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        
        // 5 saniye sonra otomatik kapat
        setTimeout(() => {
            if (popup.parentElement) {
                popup.remove();
            }
        }, 5000);
    }

    getMessageExplanation(message) {
        const messageType = message.message_type || '';
        const protocol = message.protocol || '';
        const direction = message.parameters?.direction || '';
        
        // Mesaj tipine göre açıklama
        const explanations = {
            'Attach Request': 'UE, ağa bağlanmak için bu mesajı gönderir. İlk ağ bağlantısı kurulumu.',
            'Attach Accept': 'Ağ, UE\'nin bağlantı talebini kabul eder ve gerekli parametreleri gönderir.',
            'Authentication Request': 'Ağ, UE\'nin kimlik doğrulamasını yapmak için challenge gönderir.',
            'Authentication Response': 'UE, kimlik doğrulama challenge\'ına yanıt verir.',
            'Security Mode Command': 'Ağ, güvenlik modunu aktive etmek için komut gönderir.',
            'Security Mode Complete': 'UE, güvenlik modunun başarıyla aktive edildiğini onaylar.',
            'ESM Information Request': 'Ağ, EPS Session Management bilgilerini talep eder.',
            'ESM Information Response': 'UE, talep edilen ESM bilgilerini gönderir.',
            'Activate Default EPS Bearer Context Request': 'Ağ, varsayılan veri bağlantısını aktive etmek için talep gönderir.',
            'Activate Default EPS Bearer Context Accept': 'UE, varsayılan veri bağlantısının aktivasyonunu kabul eder.',
            'RRC Connection Request': 'UE, RRC bağlantısı kurmak için talep gönderir.',
            'RRC Connection Setup': 'eNB, RRC bağlantısı kurulum parametrelerini gönderir.',
            'RRC Connection Setup Complete': 'UE, RRC bağlantısının başarıyla kurulduğunu onaylar.',
            'Measurement Report': 'UE, sinyal kalitesi ve komşu hücre ölçümlerini raporlar.',
            'Handover Command': 'Kaynak eNB, UE\'ye hedef hücreye geçiş komutunu verir.',
            'Handover Complete': 'UE, handover işleminin tamamlandığını bildirir.',
            'Paging': 'MME, UE\'yi aramak için paging mesajı gönderir. Önce S1-AP ile eNB\'ye, sonra RRC ile UE\'ye iletilir.'
        };
        
        // Protokol bazlı genel açıklamalar
        const protocolExplanations = {
            'NAS': 'Non-Access Stratum - UE ile MME arasındaki üst katman sinyalleşmesi',
            'RRC': 'Radio Resource Control - UE ile eNB arasındaki radio kaynak kontrolü',
            'PDCP': 'Packet Data Convergence Protocol - Veri paketlerinin sıkıştırılması ve şifrelenmesi',
            'RLC': 'Radio Link Control - Radio bağlantısının güvenilir veri transferi',
            'MAC': 'Medium Access Control - Radio kaynaklarının paylaşımı ve erişim kontrolü',
            'PHY': 'Physical Layer - Fiziksel katman sinyalleşmesi ve veri iletimi'
        };
        
        return explanations[messageType] || 
               protocolExplanations[protocol] || 
               `${protocol} protokolü üzerinden ${direction.includes('uplink') ? 'UE\'den ağa' : 'ağdan UE\'ye'} gönderilen ${messageType} mesajı.`;
    }

    hideCurrentMessageDetails() {
        const detailsContainer = document.getElementById('currentMessageDetails');
        if (detailsContainer) {
            detailsContainer.style.display = 'none';
        }
    }
}

// Global instance oluştur
const temsAnalyzer = new TemsAnalyzer();

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tems Call Flow Analyzer başlatıldı.');
});