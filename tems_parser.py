import re
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

class TemsParser:
    """Tems log dosyalarını parse eden ve analiz eden sınıf"""
    
    def __init__(self):
        self.message_patterns = {
            # LTE RRC log patterns
            'timestamp': r'(\d{6})\s+(\d{2}:\d{2}:\d{2}\.\d{3})',
            'message_header': r'LTE RRC OTA message\s+(\S+)\s+(\S+)',
            'rrc_message': r'LTE_Uu_RRC:\s+(\S+)',
            'message_identity': r'Message identity:\s+([^\(]+)\s*\([^\)]*\)',
            'protocol': r'Protocol:\s+(\w+)',
            'channel': r'Channel:\s+(\w+)',
            'pci': r'PCI:\s+(\d+)',
            'earfcn': r'EARFCN:\s+(\d+)',
            'cell_id': r'Cell ID:\s+(\d+)',
            'rsrp': r'RSRP:\s*\((\d+)\)\s*([\-\d\.]+)\s*dBm',
            'rsrq': r'RSRQ:\s*\((\d+)\)\s*([\-\d\.]+)\s*dB',
            'rrc_transaction': r'rrc-TransactionIdentifier:\s*(\d+)',
            'meas_id': r'measId:\s*(\d+)',
            'phys_cell_id': r'physCellId:\s*(\d+)',
            'paging_record': r'pagingRecordList\s*\[\s*(\d+)\s*\]',
            's_tmsi': r'mmec:\s*(\d+).*?m-TMSI:\s*(\d+)\s*\(0x([0-9A-Fa-f]+)\)',
            'version_info': r'Version:\s*(\d+),\s*RRC Release:\s*(\d+),\s*RRC Version:\s*(\d+)'
        }
    
    def parse_log_file(self, filepath: str) -> Dict[str, Any]:
        """Log dosyasını parse et (.log ve .trp dosyaları desteklenir)"""
        try:
            # Dosya uzantısını kontrol et
            file_extension = filepath.lower().split('.')[-1]
            
            if file_extension == 'trp':
                # .trp dosyası için binary okuma
                with open(filepath, 'rb') as file:
                    content = file.read()
                # .trp dosyasını text'e çevir
                content = self._parse_trp_content(content)
            else:
                # .log dosyası için normal okuma
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
            
            messages = self._extract_messages(content)
            call_flows = self._group_by_call_flow(messages)
            statistics = self._calculate_statistics(messages)
            
            return {
                'messages': messages,
                'call_flows': call_flows,
                'statistics': statistics,
                'total_messages': len(messages)
            }
            
        except Exception as e:
            raise Exception(f"Log dosyası parse edilirken hata: {str(e)}")
    
    def _parse_trp_content(self, binary_content):
        """TRP dosyasının binary içeriğini text formatına çevirir"""
        try:
            # TRP dosyası genellikle UTF-8 veya ASCII encoding kullanır
            # Önce UTF-8 deneyelim
            try:
                content = binary_content.decode('utf-8')
            except UnicodeDecodeError:
                # UTF-8 başarısız olursa latin-1 deneyelim
                try:
                    content = binary_content.decode('latin-1')
                except UnicodeDecodeError:
                    # Son çare olarak errors='ignore' ile decode edelim
                    content = binary_content.decode('utf-8', errors='ignore')
            
            # TRP dosyalarında genellikle null byte'lar olabilir, bunları temizleyelim
            content = content.replace('\x00', '')
            
            # Eğer içerik boşsa veya çok kısaysa hata ver
            if len(content.strip()) < 10:
                raise Exception("TRP dosyası içeriği çok kısa veya boş")
            
            return content
            
        except Exception as e:
            raise Exception(f"TRP dosyası parse edilirken hata: {str(e)}")
    
    def _extract_messages(self, content: str) -> List[Dict[str, Any]]:
        """Log içeriğinden mesajları çıkar"""
        messages = []
        
        # "---" ile ayrılmış blokları bul
        message_blocks = re.split(r'\n\s*---\s*\n', content)
        
        for block_idx, block in enumerate(message_blocks):
            if not block.strip():
                continue
                
            # Yeni format kontrolü: [PROTOCOL] [DIRECTION] [SOURCE->DEST] MESSAGE
            new_format_match = re.search(r'(\d{6})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+\[(\w+)\]\s+\[(\w+)\]\s+\[([^\]]+)\]\s+(.+)', block)
            
            if new_format_match:
                # Yeni format mesajı
                timestamp_num = new_format_match.group(1)
                timestamp_time = new_format_match.group(2)
                protocol = new_format_match.group(3)
                direction = new_format_match.group(4)
                source_dest = new_format_match.group(5)
                message_content = new_format_match.group(6)
                
                # Mesaj tipini çıkar
                message_type = 'Unknown'
                if ':' in message_content:
                    message_type = message_content.split(':')[0].strip()
                
                # Source ve destination'ı parse et
                source = 'Unknown'
                destination = 'Unknown'
                if '->' in source_dest:
                    parts = source_dest.split('->')
                    source = parts[0].strip()
                    destination = parts[1].strip()
                
                current_message = {
                    'id': len(messages) + 1,
                    'timestamp': f"{timestamp_num} {timestamp_time}",
                    'timestamp_num': timestamp_num,
                    'timestamp_time': timestamp_time,
                    'line_number': 1,
                    'block_number': block_idx + 1,
                    'message_type': message_type,
                    'protocol_type': protocol,
                    'channel': direction,
                    'message_identity': message_type,
                    'protocol': protocol,
                    'source': source,
                    'destination': destination,
                    'pci': None,
                    'earfcn': None,
                    'rrc_transaction_id': None,
                    'is_paging': 'paging' in message_content.lower(),
                    'is_measurement': False,
                    'is_connection_related': 'service request' in message_content.lower(),
                    'parameters': {
                        'direction': direction.lower(),
                        'source_dest': source_dest,
                        'content': message_content,
                        'protocol_detail': protocol,
                        'channel_detail': direction
                    },
                    'measurements': {},
                    'paging_info': {},
                    'raw_content': block.strip()
                }
                messages.append(current_message)
                continue
            
            # Eski format için mevcut kod
            lines = block.split('\n')
            current_message = None
            message_buffer = []
            
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Timestamp kontrolü - yeni mesaj başlangıcı
                timestamp_match = re.search(self.message_patterns['timestamp'], line)
                if timestamp_match:
                    # Önceki mesajı kaydet
                    if current_message and message_buffer:
                        current_message['raw_content'] = '\n'.join(message_buffer)
                        messages.append(current_message)
                    
                    # Yeni mesaj başlat
                    timestamp_num = timestamp_match.group(1)
                    timestamp_time = timestamp_match.group(2)
                    
                    current_message = {
                        'id': len(messages) + 1,
                        'timestamp': f"{timestamp_num} {timestamp_time}",
                        'timestamp_num': timestamp_num,
                        'timestamp_time': timestamp_time,
                        'line_number': i + 1,
                        'block_number': block_idx + 1,
                        'message_type': self._extract_lte_message_type(line),
                        'protocol_type': 'LTE_RRC',
                        'channel': self._extract_channel(block),
                        'message_identity': self._extract_message_identity(block),
                        'protocol': self._extract_protocol(block),
                        'pci': self._extract_pci(block),
                        'earfcn': self._extract_earfcn(block),
                        'rrc_transaction_id': self._extract_rrc_transaction(block),
                        'is_paging': self._is_paging_message(block),
                        'is_measurement': self._is_measurement_message(block),
                        'is_connection_related': self._is_connection_related(block),
                        'parameters': self._extract_lte_parameters(block),
                        'measurements': self._extract_measurements(block),
                        'paging_info': self._extract_paging_info(block)
                    }
                    message_buffer = [line]
                else:
                    # Mevcut mesaja ekle
                    if current_message:
                        message_buffer.append(line)
            
            # Son mesajı kaydet
            if current_message and message_buffer:
                current_message['raw_content'] = '\n'.join(message_buffer)
                messages.append(current_message)
        
        return messages
    
    def _extract_lte_message_type(self, line: str) -> str:
        """LTE RRC mesaj tipini çıkar"""
        match = re.search(self.message_patterns['message_header'], line)
        if match:
            return match.group(2)  # UL-DCCH, DL-DCCH, PCCH, BCCH-DL_SCH
        return 'Unknown'
    
    def _extract_channel(self, block: str) -> str:
        """Kanal bilgisini çıkar"""
        match = re.search(self.message_patterns['channel'], block)
        return match.group(1) if match else 'Unknown'
    
    def _extract_message_identity(self, block: str) -> str:
        """Mesaj kimliğini çıkar"""
        match = re.search(self.message_patterns['message_identity'], block)
        return match.group(1).strip() if match else 'Unknown'
    
    def _extract_protocol(self, block: str) -> str:
        """Protokol bilgisini çıkar"""
        match = re.search(self.message_patterns['protocol'], block)
        return match.group(1) if match else 'Unknown'
    
    def _extract_pci(self, block: str) -> Optional[int]:
        """PCI değerini çıkar"""
        match = re.search(self.message_patterns['pci'], block)
        return int(match.group(1)) if match else None
    
    def _extract_earfcn(self, block: str) -> Optional[int]:
        """EARFCN değerini çıkar"""
        match = re.search(self.message_patterns['earfcn'], block)
        return int(match.group(1)) if match else None
    
    def _extract_rrc_transaction(self, block: str) -> Optional[int]:
        """RRC Transaction ID'yi çıkar"""
        match = re.search(self.message_patterns['rrc_transaction'], block)
        return int(match.group(1)) if match else None
    
    def _extract_protocol_type(self, line: str) -> str:
        """Protokol tipini belirle"""
        line_upper = line.upper()
        
        if 'PAGING' in line_upper:
            return 'Paging'
        elif 'CALL' in line_upper:
            return 'Call Setup'
        elif 'HANDOVER' in line_upper:
            return 'Handover'
        elif 'LOCATION' in line_upper:
            return 'Location Update'
        elif 'AUTH' in line_upper:
            return 'Authentication'
        elif 'SMS' in line_upper:
            return 'SMS'
        else:
            return 'Other'
    
    def _extract_source_dest(self, line: str, type_: str) -> Optional[str]:
        """Source veya destination bilgisini çıkar"""
        patterns = {
            'source': r'(From|Source):\s*([A-Za-z0-9_]+)',
            'destination': r'(To|Dest|Destination):\s*([A-Za-z0-9_]+)'
        }
        
        match = re.search(patterns.get(type_, ''), line, re.IGNORECASE)
        return match.group(2) if match else None
    
    def _extract_transaction_id(self, line: str) -> Optional[str]:
        """Transaction ID'yi çıkar"""
        match = re.search(self.message_patterns['transaction_id'], line, re.IGNORECASE)
        return match.group(2) if match else None
    
    def _is_paging_message(self, block: str) -> bool:
        """Paging mesajı mı kontrol et"""
        return 'Paging' in block or 'PCCH' in block
    
    def _is_measurement_message(self, block: str) -> bool:
        """Measurement mesajı mı kontrol et"""
        return 'MeasurementReport' in block or 'measurementReport' in block
    
    def _is_connection_related(self, block: str) -> bool:
        """Connection ile ilgili mesaj mı kontrol et"""
        connection_keywords = ['RRCConnectionReconfiguration', 'RRCConnectionRelease', 'RRCConnectionSetup']
        return any(keyword in block for keyword in connection_keywords)
    
    def _extract_measurements(self, block: str) -> Dict[str, Any]:
        """Measurement verilerini çıkar"""
        measurements = {}
        
        # RSRP değerleri
        rsrp_matches = re.findall(self.message_patterns['rsrp'], block)
        if rsrp_matches:
            measurements['rsrp_values'] = [{'raw': int(m[0]), 'dbm': float(m[1])} for m in rsrp_matches]
        
        # RSRQ değerleri
        rsrq_matches = re.findall(self.message_patterns['rsrq'], block)
        if rsrq_matches:
            measurements['rsrq_values'] = [{'raw': int(m[0]), 'db': float(m[1])} for m in rsrq_matches]
        
        # Measurement ID
        meas_id_match = re.search(self.message_patterns['meas_id'], block)
        if meas_id_match:
            measurements['meas_id'] = int(meas_id_match.group(1))
        
        # Physical Cell IDs
        phys_cell_matches = re.findall(self.message_patterns['phys_cell_id'], block)
        if phys_cell_matches:
            measurements['neighbor_cells'] = [int(cell_id) for cell_id in phys_cell_matches]
        
        return measurements
    
    def _extract_paging_info(self, block: str) -> Dict[str, Any]:
        """Paging bilgilerini çıkar"""
        paging_info = {}
        
        if self._is_paging_message(block):
            # S-TMSI bilgileri
            s_tmsi_matches = re.findall(self.message_patterns['s_tmsi'], block)
            if s_tmsi_matches:
                paging_info['paging_records'] = []
                for match in s_tmsi_matches:
                    paging_info['paging_records'].append({
                        'mmec': int(match[0]),
                        'm_tmsi': int(match[1]),
                        'm_tmsi_hex': match[2]
                    })
        
        return paging_info
    
    def _extract_message_direction(self, block: str, protocol: str, channel: str, message_type: str) -> str:
        """Mesaj yönünü belirle"""
        protocol_lower = protocol.lower() if protocol else ''
        channel_lower = channel.lower() if channel else ''
        message_type_lower = message_type.lower() if message_type else ''
        
        # Kanal bilgisine göre yön belirleme
        if 'ul' in channel_lower or 'uplink' in channel_lower:
            return 'uplink'
        elif 'dl' in channel_lower or 'downlink' in channel_lower:
            return 'downlink'
        
        # Mesaj tipine göre yön belirleme
        uplink_messages = [
            'rrcconnectionrequest', 'rrcconnectionsetupcomplete', 'rrcconnectionreconfigurationcomplete',
            'measurementreport', 'ulhandoverpreparationtransfer', 'ulnastransport', 'initialuemessage',
            'uplinkdatatransfer', 'rrcconnectionreestablishmentrequest', 'rrcconnectionreestablishmentcomplete',
            'securitymodecompleterequest', 'uecapabilityinformation', 'attachrequest', 'authenticationresponse',
            'securitymodecomplete', 'attachcomplete', 'trackingareaupdaterequest'
        ]
        
        downlink_messages = [
            'rrcconnectionsetup', 'rrcconnectionreconfiguration', 'rrcconnectionrelease',
            'dlhandoverpreparationtransfer', 'dlnastransport', 'initialcontextsetupresponse',
            'downlinkdatatransfer', 'rrcconnectionreestablishment', 'rrcconnectionreestablishmentreject',
            'securitymodecommand', 'uecapabilityenquiry', 'attachaccept', 'authenticationrequest',
            'attachreject', 'trackingareaupdateaccept', 'paging'
        ]
        
        for ul_msg in uplink_messages:
            if ul_msg in message_type_lower:
                return 'uplink'
        
        for dl_msg in downlink_messages:
            if dl_msg in message_type_lower:
                return 'downlink'
        
        # Protocol ve içerik analizi
        if 'nas' in protocol_lower:
            # NAS mesajları için içerik analizi
            if any(keyword in block.lower() for keyword in ['attach request', 'tau request', 'service request']):
                return 'uplink'
            elif any(keyword in block.lower() for keyword in ['attach accept', 'tau accept', 'authentication request']):
                return 'downlink'
        
        elif 's1ap' in protocol_lower:
            # S1-AP mesajları için içerik analizi
            if any(keyword in block.lower() for keyword in ['initial ue message', 'uplink nas transport']):
                return 'uplink'
            elif any(keyword in block.lower() for keyword in ['initial context setup', 'downlink nas transport']):
                return 'downlink'
        
        # Varsayılan olarak bilinmeyen
        return 'unknown'
    
    def _extract_lte_parameters(self, block: str) -> Dict[str, str]:
        """LTE spesifik parametreleri çıkar"""
        parameters = {}
        
        # Version bilgileri
        version_match = re.search(self.message_patterns['version_info'], block)
        if version_match:
            parameters['version'] = version_match.group(1)
            parameters['rrc_release'] = version_match.group(2)
            parameters['rrc_version'] = version_match.group(3)
        
        # RRC mesaj tipi
        rrc_match = re.search(self.message_patterns['rrc_message'], block)
        if rrc_match:
            parameters['rrc_message_type'] = rrc_match.group(1)
        
        # Mesaj türüne göre spesifik içerik ekleme
        message_type = self._extract_lte_message_type(block)
        parameters.update(self._get_message_specific_content(message_type, block))
        
        # Mesaj yönünü belirle
        protocol = self._extract_protocol(block)
        channel = self._extract_channel(block)
        direction = self._extract_message_direction(block, protocol, channel, message_type)
        parameters['direction'] = direction
        
        # Events bilgisini çıkar
        events_match = re.search(r'Events:\s*\n([^\n]*(?:\n[^\n]*)*?)(?=\n\n|\nLayer|\nProtocol|$)', block, re.MULTILINE)
        if events_match:
            parameters['events'] = events_match.group(1).strip()
        
        # Layer 3 Message bilgisini çıkar
        layer3_match = re.search(r'Layer 3 Message:\s*Message identity:\s*([^\(]+)\s*\([^\)]*\)', block)
        if layer3_match:
            parameters['layer3_message'] = layer3_match.group(1).strip()
        
        # Protocol bilgisini çıkar (daha detaylı)
        protocol_match = re.search(r'Protocol:\s*(\w+)', block)
        if protocol_match:
            parameters['protocol_detail'] = protocol_match.group(1)
        
        # Channel bilgisini çıkar (daha detaylı)
        channel_match = re.search(r'Channel:\s*(\w+)', block)
        if channel_match:
            parameters['channel_detail'] = channel_match.group(1)
        
        # LTE RRC Protocol Version
        lte_version_match = re.search(r'LTE RRC Protocol Version:\s*([\d\.]+)', block)
        if lte_version_match:
            parameters['lte_rrc_version'] = lte_version_match.group(1)
        
        # NR 5G RRC Protocol Version
        nr_version_match = re.search(r'NR 5G RRC Protocol Version:\s*([\d\.]+)', block)
        if nr_version_match:
            parameters['nr_rrc_version'] = nr_version_match.group(1)
        
        # RB Id, SubFN, SysFN bilgilerini çıkar
        rb_match = re.search(r'RB Id:\s*(\d+)', block)
        if rb_match:
            parameters['rb_id'] = rb_match.group(1)
        
        subfn_match = re.search(r'SubFN:\s*(\d+)', block)
        if subfn_match:
            parameters['subfn'] = subfn_match.group(1)
        
        sysfn_match = re.search(r'SysFN:\s*(\d+)', block)
        if sysfn_match:
            parameters['sysfn'] = sysfn_match.group(1)
        
        return parameters
    
    def _get_message_specific_content(self, message_type: str, block: str) -> Dict[str, str]:
        """Mesaj türüne göre spesifik içerik döndür"""
        content = {}
        
        if 'RRCConnectionReconfigurationComplete' in message_type:
            content['purpose'] = 'UE tarafından RRC bağlantı yeniden yapılandırmasının başarıyla tamamlandığını onaylar'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-DCCH'
            content['content_structure'] = 'RRC Transaction ID, Completion confirmation'
            
        elif 'MeasurementReport' in message_type:
            content['purpose'] = 'Serving ve komşu hücrelerin sinyal kalitesi ölçümlerini raporlar'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-DCCH'
            content['content_structure'] = 'Measurement ID, RSRP/RSRQ değerleri, PCI listesi'
            
        elif 'RRCConnectionRequest' in message_type:
            content['purpose'] = 'UE tarafından RRC bağlantısı kurma talebi'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-CCCH'
            content['content_structure'] = 'UE Identity, Establishment Cause'
            
        elif 'Paging' in message_type:
            content['purpose'] = 'Ağ tarafından UE\'yi arama ve uyandırma'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'PCCH'
            content['content_structure'] = 'Paging Record List, System Info Modification'
            
        elif 'RRCConnectionReconfiguration' in message_type:
            content['purpose'] = 'Radyo kaynakları ve parametrelerinin yeniden yapılandırılması'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'DL-DCCH'
            content['content_structure'] = 'Radio Resource Config, Mobility Control Info'
            
        elif 'RRCConnectionRelease' in message_type:
            content['purpose'] = 'RRC bağlantısının sonlandırılması ve IDLE moda geçiş'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'DL-DCCH'
            content['content_structure'] = 'Release Cause, Redirect Info'
            
        elif 'RRCConnectionSetup' in message_type:
            content['purpose'] = 'RRC bağlantısının kurulması ve radyo kaynaklarının atanması'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'DL-CCCH'
            content['content_structure'] = 'Radio Resource Config, RRC Transaction ID'
            
        elif 'SystemInformationBlockType' in message_type or 'SIB' in message_type:
            content['purpose'] = 'Hücre ve sistem parametrelerinin yayınlanması'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'BCCH-DL-SCH'
            content['content_structure'] = 'Cell Access Info, Frequency Info, Neighbor Cell List'
            
        elif 'RRCConnectionSetupComplete' in message_type:
            content['purpose'] = 'RRC bağlantı kurulumunun teyidi ve NAS mesajının iletimi'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-DCCH'
            content['content_structure'] = 'Selected PLMN, Dedicated Info NAS'
            
        elif 'SecurityModeCommand' in message_type:
            content['purpose'] = 'Güvenlik algoritmaları ve şifreleme parametrelerinin aktivasyonu'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'DL-DCCH'
            content['content_structure'] = 'Security Config SMC, Ciphering Algorithm, Integrity Algorithm'
            
        elif 'SecurityModeComplete' in message_type:
            content['purpose'] = 'Güvenlik prosedürlerinin başarıyla tamamlandığının onayı'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-DCCH'
            content['content_structure'] = 'RRC Transaction ID, Security completion confirmation'
            
        elif 'UECapabilityEnquiry' in message_type:
            content['purpose'] = 'UE yeteneklerinin sorgulanması'
            content['direction'] = 'Downlink (eNB → UE)'
            content['channel'] = 'DL-DCCH'
            content['content_structure'] = 'UE Capability Request, RAT Type'
            
        elif 'UECapabilityInformation' in message_type:
            content['purpose'] = 'UE yetenekleri ve desteklenen özelliklerin raporlanması'
            content['direction'] = 'Uplink (UE → eNB)'
            content['channel'] = 'UL-DCCH'
            content['content_structure'] = 'Supported Band List, Category Info, Feature Group Indicators'
            
        elif 'ServiceRequest' in message_type:
            content['purpose'] = 'Çekirdek ağ hizmetlerine erişim talebi'
            content['direction'] = 'Uplink (UE → MME)'
            content['channel'] = 'NAS/EMM'
            content['content_structure'] = 'Service Type, KSI and Sequence Number, Authentication Token'
        
        return content
    
    def _extract_parameters(self, line: str) -> Dict[str, str]:
        """Satırdan parametreleri çıkar"""
        params = {}
        
        # Genel parametre pattern'i
        param_patterns = [
            r'(IMSI|TMSI|LAI|CI|MSISDN):\s*([A-Za-z0-9]+)',
            r'(MCC|MNC|LAC|CellId):\s*([0-9]+)',
            r'(Cause|Result|Status):\s*([A-Za-z0-9_\s]+)',
        ]
        
        for pattern in param_patterns:
            matches = re.finditer(pattern, line, re.IGNORECASE)
            for match in matches:
                params[match.group(1).upper()] = match.group(2)
        
        return params
    
    def _group_by_call_flow(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Mesajları call flow'lara göre grupla"""
        call_flows = []
        current_flow = None
        
        for message in messages:
            # Yeni call flow başlangıcı kontrolü
            if (message['protocol_type'] in ['Paging', 'Call Setup'] and 
                message['message_type'] == 'Request'):
                
                # Önceki flow'u kaydet
                if current_flow:
                    call_flows.append(current_flow)
                
                # Yeni flow başlat
                current_flow = {
                    'id': len(call_flows) + 1,
                    'start_time': message['timestamp'],
                    'type': message['protocol_type'],
                    'messages': [message],
                    'status': 'In Progress',
                    'duration': None
                }
            elif current_flow:
                current_flow['messages'].append(message)
                
                # Flow tamamlanma kontrolü
                if message['message_type'] in ['Response', 'Complete']:
                    current_flow['status'] = 'Completed'
                    current_flow['end_time'] = message['timestamp']
                    current_flow['duration'] = self._calculate_duration(
                        current_flow['start_time'], 
                        message['timestamp']
                    )
        
        # Son flow'u kaydet
        if current_flow:
            call_flows.append(current_flow)
        
        return call_flows
    
    def _calculate_duration(self, start_time: str, end_time: str) -> Optional[float]:
        """İki zaman arasındaki süreyi hesapla (milisaniye)"""
        try:
            start = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S.%f')
            end = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S.%f')
            return (end - start).total_seconds() * 1000
        except:
            return None
    
    def _calculate_statistics(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Mesajlardan istatistikleri hesapla"""
        total_messages = len(messages)
        paging_count = sum(1 for msg in messages if msg.get('is_paging', False))
        measurement_count = sum(1 for msg in messages if msg.get('is_measurement', False))
        connection_count = sum(1 for msg in messages if msg.get('is_connection_related', False))
        
        # Mesaj tiplerini say
        message_types = {}
        channels = {}
        protocols = {}
        
        for msg in messages:
            # Mesaj tipi istatistikleri
            msg_identity = msg.get('message_identity', 'Unknown')
            message_types[msg_identity] = message_types.get(msg_identity, 0) + 1
            
            # Kanal istatistikleri
            channel = msg.get('channel', 'Unknown')
            channels[channel] = channels.get(channel, 0) + 1
            
            # Protokol istatistikleri
            protocol = msg.get('protocol', 'Unknown')
            protocols[protocol] = protocols.get(protocol, 0) + 1
        
        # RSRP/RSRQ istatistikleri
        rsrp_values = []
        rsrq_values = []
        
        for msg in messages:
            measurements = msg.get('measurements', {})
            if 'rsrp_values' in measurements:
                rsrp_values.extend([m['dbm'] for m in measurements['rsrp_values']])
            if 'rsrq_values' in measurements:
                rsrq_values.extend([m['db'] for m in measurements['rsrq_values']])
        
        rsrp_stats = {}
        rsrq_stats = {}
        
        if rsrp_values:
            rsrp_stats = {
                'min': min(rsrp_values),
                'max': max(rsrp_values),
                'avg': sum(rsrp_values) / len(rsrp_values),
                'count': len(rsrp_values)
            }
        
        if rsrq_values:
            rsrq_stats = {
                'min': min(rsrq_values),
                'max': max(rsrq_values),
                'avg': sum(rsrq_values) / len(rsrq_values),
                'count': len(rsrq_values)
            }
        
        return {
            'total_messages': total_messages,
            'paging_messages': paging_count,
            'measurement_messages': measurement_count,
            'connection_messages': connection_count,
            'other_messages': total_messages - paging_count - measurement_count - connection_count,
            'message_types': message_types,
            'channels': channels,
            'protocols': protocols,
            'rsrp_statistics': rsrp_stats,
            'rsrq_statistics': rsrq_stats
        }
    
    def analyze_call_flow(self, log_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Call flow analizi yap"""
        analysis = {
            'flow_diagram': self._generate_flow_diagram(log_data),
            'timing_analysis': self._analyze_timing(log_data),
            'error_analysis': self._analyze_errors(log_data),
            'recommendations': self._generate_recommendations(log_data)
        }
        
        return analysis
    
    def _generate_flow_diagram(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Flow diagramı için veri oluştur"""
        diagram_data = []
        
        for i, message in enumerate(messages):
            diagram_data.append({
                'step': i + 1,
                'timestamp': message['timestamp'],
                'source': message.get('source', 'Unknown'),
                'destination': message.get('destination', 'Unknown'),
                'message_type': message['message_type'],
                'protocol': message.get('protocol_type', message.get('protocol', 'Unknown')),
                'description': f"{message.get('protocol_type', message.get('protocol', 'Unknown'))} {message['message_type']}",
                'is_error': 'error' in message.get('raw_content', '').lower()
            })
        
        return diagram_data
    
    def _analyze_timing(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Timing analizi yap"""
        timing_data = {
            'total_duration': None,
            'average_response_time': None,
            'slow_operations': []
        }
        
        if len(messages) >= 2:
            try:
                start_time = datetime.strptime(messages[0]['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                end_time = datetime.strptime(messages[-1]['timestamp'], '%Y-%m-%d %H:%M:%S.%f')
                timing_data['total_duration'] = (end_time - start_time).total_seconds() * 1000
            except:
                pass
        
        return timing_data
    
    def _analyze_errors(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Hata analizi yap"""
        errors = []
        
        for message in messages:
            content = message.get('raw_content', '').lower()
            if any(keyword in content for keyword in ['error', 'fail', 'reject', 'timeout']):
                errors.append({
                    'message_id': message['id'],
                    'timestamp': message['timestamp'],
                    'type': 'Error',
                    'description': f"Error detected in {message['protocol_type']} message"
                })
        
        return errors
    
    def _generate_recommendations(self, messages: List[Dict[str, Any]]) -> List[str]:
        """Öneriler oluştur"""
        recommendations = []
        
        paging_count = sum(1 for msg in messages if msg['is_paging'])
        if paging_count > 10:
            recommendations.append("Yüksek paging trafiği tespit edildi. Ağ optimizasyonu gerekebilir.")
        
        error_count = sum(1 for msg in messages if 'error' in msg.get('raw_content', '').lower())
        if error_count > 0:
            recommendations.append(f"{error_count} hata mesajı tespit edildi. Detaylı inceleme önerilir.")
        
        return recommendations
    
    def filter_messages(self, messages: List[Dict[str, Any]], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Mesajları filtrele"""
        filtered = messages.copy()
        
        # Protokol filtresi
        if filters.get('protocol'):
            filtered = [msg for msg in filtered if msg.get('protocol') == filters['protocol']]
        
        # Mesaj türü filtresi (lte_message_type alanını kontrol et)
        if filters.get('message_type'):
            filtered = [msg for msg in filtered if msg.get('lte_message_type') == filters['message_type']]
        
        # Mesaj yönü filtresi
        if filters.get('message_direction'):
            direction_filter = filters['message_direction']
            filtered_by_direction = []
            
            for msg in filtered:
                protocol = (msg.get('protocol') or '').lower()
                direction = (msg.get('parameters', {}).get('direction') or '').lower()
                
                # Mesaj yönünü belirle
                if direction_filter == 'ue_to_enb':
                    # UE'den eNB'ye: RRC UL mesajları
                    if ('rrc' in protocol or 'lte_rrc' in protocol) and direction == 'uplink':
                        filtered_by_direction.append(msg)
                elif direction_filter == 'enb_to_ue':
                    # eNB'den UE'ye: RRC DL mesajları
                    if ('rrc' in protocol or 'lte_rrc' in protocol) and direction == 'downlink':
                        filtered_by_direction.append(msg)
                elif direction_filter == 'enb_to_mme':
                    # eNB'den MME'ye: S1-AP UL mesajları
                    if 's1ap' in protocol and direction == 'uplink':
                        filtered_by_direction.append(msg)
                elif direction_filter == 'mme_to_enb':
                    # MME'den eNB'ye: S1-AP DL mesajları
                    if 's1ap' in protocol and direction == 'downlink':
                        filtered_by_direction.append(msg)
                elif direction_filter == 'ue_to_mme':
                    # UE'den MME'ye: NAS UL mesajları
                    if 'nas' in protocol and direction == 'uplink':
                        filtered_by_direction.append(msg)
                elif direction_filter == 'mme_to_ue':
                    # MME'den UE'ye: NAS DL mesajları
                    if 'nas' in protocol and direction == 'downlink':
                        filtered_by_direction.append(msg)
            
            filtered = filtered_by_direction
        
        # Kanal filtresi
        if filters.get('channel'):
            filtered = [msg for msg in filtered if msg.get('channel') == filters['channel']]
        
        # Mesaj kimliği filtresi (kısmi eşleşme)
        if filters.get('message_identity'):
            filtered = [msg for msg in filtered if filters['message_identity'].lower() in msg.get('message_identity', '').lower()]
        
        # PCI filtresi
        if filters.get('pci'):
            try:
                pci_value = int(filters['pci'])
                filtered = [msg for msg in filtered if msg.get('pci') == pci_value]
            except (ValueError, TypeError):
                pass
        
        # EARFCN filtresi
        if filters.get('earfcn'):
            try:
                earfcn_value = int(filters['earfcn'])
                filtered = [msg for msg in filtered if msg.get('earfcn') == earfcn_value]
            except (ValueError, TypeError):
                pass
        
        # Boolean filtreler
        if filters.get('is_paging') is not None:
            filtered = [msg for msg in filtered if msg.get('is_paging') == filters['is_paging']]
        
        if filters.get('is_measurement') is not None:
            filtered = [msg for msg in filtered if msg.get('is_measurement') == filters['is_measurement']]
        
        if filters.get('is_connection_related') is not None:
            filtered = [msg for msg in filtered if msg.get('is_connection_related') == filters['is_connection_related']]
        
        # RRC Transaction ID filtresi
        if filters.get('rrc_transaction_id'):
            try:
                rrc_id = int(filters['rrc_transaction_id'])
                filtered = [msg for msg in filtered if msg.get('rrc_transaction_id') == rrc_id]
            except (ValueError, TypeError):
                pass
        
        # RSRP filtresi
        if filters.get('min_rsrp') or filters.get('max_rsrp'):
            def has_rsrp_in_range(msg):
                measurements = msg.get('measurements', {})
                if 'rsrp_values' in measurements:
                    for rsrp in measurements['rsrp_values']:
                        try:
                            dbm_value = float(rsrp['dbm'])
                            if filters.get('min_rsrp') and dbm_value < float(filters['min_rsrp']):
                                continue
                            if filters.get('max_rsrp') and dbm_value > float(filters['max_rsrp']):
                                continue
                            return True
                        except (ValueError, TypeError, KeyError):
                            continue
                return False
            filtered = [msg for msg in filtered if has_rsrp_in_range(msg)]
        
        # Zaman aralığı filtresi
        if filters.get('start_time') and filters.get('end_time'):
            try:
                start = datetime.strptime(filters['start_time'], '%Y-%m-%d %H:%M:%S')
                end = datetime.strptime(filters['end_time'], '%Y-%m-%d %H:%M:%S')
                filtered = [msg for msg in filtered 
                           if start <= datetime.strptime(msg['timestamp'], '%Y-%m-%d %H:%M:%S.%f') <= end]
            except (ValueError, KeyError):
                pass
        
        return filtered