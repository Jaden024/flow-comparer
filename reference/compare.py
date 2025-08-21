import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import difflib


@dataclass
class HarRequest:
    """Представляет HTTP запрос из HAR файла"""
    method: str
    url: str
    path: str
    headers: Dict[str, str]
    query_params: Dict[str, List[str]]
    post_data: Optional[str]
    response_status: int
    response_headers: Dict[str, str]
    response_body: Optional[str]
    index: int  # Порядковый номер в файле


class HarParser:
    """Парсер HAR файлов"""

    @staticmethod
    def parse_har_file(file_path: str) -> List[HarRequest]:
        """Парсит HAR файл и возвращает список запросов"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                har_data = json.load(f)

            requests = []
            entries = har_data.get('log', {}).get('entries', [])

            for index, entry in enumerate(entries):
                request_data = entry.get('request', {})
                response_data = entry.get('response', {})

                # Извлекаем URL и path
                url = request_data.get('url', '')
                parsed_url = urlparse(url)
                path = parsed_url.path
                if parsed_url.query:
                    path += '?' + parsed_url.query

                # Извлекаем заголовки запроса
                headers = {}
                for header in request_data.get('headers', []):
                    headers[header.get('name', '')] = header.get('value', '')

                # Извлекаем параметры запроса
                query_params = parse_qs(parsed_url.query) if parsed_url.query else {}

                # Извлекаем POST данные
                post_data = None
                if 'postData' in request_data:
                    post_data = request_data['postData'].get('text', '')

                # Извлекаем заголовки ответа
                response_headers = {}
                for header in response_data.get('headers', []):
                    response_headers[header.get('name', '')] = header.get('value', '')

                # Извлекаем тело ответа
                response_body = None
                if 'content' in response_data:
                    response_body = response_data['content'].get('text', '')

                har_request = HarRequest(
                    method=request_data.get('method', ''),
                    url=url,
                    path=path,
                    headers=headers,
                    query_params=query_params,
                    post_data=post_data,
                    response_status=response_data.get('status', 0),
                    response_headers=response_headers,
                    response_body=response_body,
                    index=index
                )

                requests.append(har_request)

            return requests

        except Exception as e:
            raise Exception(f"Ошибка при парсинге HAR файла {file_path}: {str(e)}")


class RequestComparator:
    """Класс для сравнения запросов"""

    @staticmethod
    def compare_requests(req1: HarRequest, req2: HarRequest, keys_only: bool = False) -> str:
        """
        Сравнивает два запроса и возвращает статус:
        'match' - полное совпадение
        'partial' - совпадает path, но отличается содержимое
        'different' - разные запросы
        """
        if req1.path != req2.path:
            return 'different'

        if keys_only:
            # Сравниваем только ключи (параметры запроса, заголовки)
            if (set(req1.query_params.keys()) == set(req2.query_params.keys()) and
                set(req1.headers.keys()) == set(req2.headers.keys())):
                return 'match'
            else:
                return 'partial'
        else:
            # Полное сравнение
            if (req1.method == req2.method and
                req1.query_params == req2.query_params and
                req1.headers == req2.headers and
                req1.post_data == req2.post_data):
                return 'match'
            else:
                return 'partial'

    @staticmethod
    def find_matching_requests(requests1: List[HarRequest], requests2: List[HarRequest]) -> Dict[str, List[Tuple[int, int]]]:
        """
        Находит соответствующие запросы между двумя списками по path.
        Возвращает словарь: path -> [(index1, index2), ...]
        """
        path_matches = {}

        # Группируем запросы по path
        paths1 = {}
        paths2 = {}

        for i, req in enumerate(requests1):
            if req.path not in paths1:
                paths1[req.path] = []
            paths1[req.path].append(i)

        for i, req in enumerate(requests2):
            if req.path not in paths2:
                paths2[req.path] = []
            paths2[req.path].append(i)

        # Находим пересечения
        for path in paths1:
            if path in paths2:
                matches = []
                indices1 = paths1[path]
                indices2 = paths2[path]

                # Сопоставляем первый с первым, второй со вторым и т.д.
                for i in range(max(len(indices1), len(indices2))):
                    idx1 = indices1[i] if i < len(indices1) else None
                    idx2 = indices2[i] if i < len(indices2) else None
                    matches.append((idx1, idx2))

                path_matches[path] = matches

        return path_matches

    @staticmethod
    def align_requests_like_vscode(requests1: List[HarRequest], requests2: List[HarRequest]) -> List[Tuple[Optional[int], Optional[int]]]:
        """
        Выравнивает запросы как в VS Code - подгоняет одинаковые пути друг к другу,
        сохраняя порядок и вставляя пустые места для отсутствующих запросов
        """
        # Создаем списки путей для сравнения
        paths1 = [req.path for req in requests1]
        paths2 = [req.path for req in requests2]

        # Используем difflib для поиска последовательности операций
        matcher = difflib.SequenceMatcher(None, paths1, paths2)
        opcodes = matcher.get_opcodes()

        aligned_pairs = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == 'equal':
                # Одинаковые пути - сопоставляем их
                for k in range(i2 - i1):
                    aligned_pairs.append((i1 + k, j1 + k))

            elif tag == 'delete':
                # Запросы есть только в первом файле
                for k in range(i2 - i1):
                    aligned_pairs.append((i1 + k, None))

            elif tag == 'insert':
                # Запросы есть только во втором файле
                for k in range(j2 - j1):
                    aligned_pairs.append((None, j1 + k))

            elif tag == 'replace':
                # Разные запросы - выравниваем как можем
                len1 = i2 - i1
                len2 = j2 - j1
                max_len = max(len1, len2)

                for k in range(max_len):
                    idx1 = (i1 + k) if k < len1 else None
                    idx2 = (j1 + k) if k < len2 else None
                    aligned_pairs.append((idx1, idx2))

        return aligned_pairs


class JsonFormatter:
    """Класс для форматирования JSON"""

    @staticmethod
    def format_json_string(json_str: str) -> str:
        """Форматирует JSON строку для красивого отображения"""
        if not json_str or not json_str.strip():
            return "Отсутствует"

        try:
            # Пытаемся распарсить как JSON
            parsed = json.loads(json_str)
            # Форматируем с отступами
            return json.dumps(parsed, indent=2, ensure_ascii=False, sort_keys=True)
        except (json.JSONDecodeError, TypeError):
            # Если не JSON, возвращаем как есть
            return json_str

    @staticmethod
    def format_headers_dict(headers_dict: Dict[str, str]) -> str:
        """Форматирует словарь заголовков"""
        if not headers_dict:
            return "Отсутствуют"

        formatted_lines = []
        for key, value in sorted(headers_dict.items()):
            formatted_lines.append(f"{key}: {value}")
        return "\n".join(formatted_lines)

    @staticmethod
    def format_params_dict(params_dict: Dict[str, List[str]]) -> str:
        """Форматирует словарь параметров"""
        if not params_dict:
            return "Отсутствуют"

        formatted_lines = []
        for key, values in sorted(params_dict.items()):
            formatted_lines.append(f"{key}: {', '.join(values)}")
        return "\n".join(formatted_lines)


class HarCompareGUI:
    """Главное окно приложения для сравнения HAR файлов"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("HAR Files Comparator")
        self.root.geometry("1400x800")

        # Данные
        self.requests1 = []
        self.requests2 = []
        self.file1_path = ""
        self.file2_path = ""
        self.keys_only_var = tk.BooleanVar()
        self.align_requests_var = tk.BooleanVar()  # Новая галочка для подгонки запросов
        self.sync_scroll_var = tk.BooleanVar()  # Галочка для синхронной прокрутки

        # Выбранные запросы для сравнения
        self.selected_request1 = None
        self.selected_request2 = None
        self.selected_item1 = None
        self.selected_item2 = None

        # Флаг для предотвращения рекурсивной прокрутки
        self.scrolling_in_progress = False

        # Создаем интерфейс
        self.create_widgets()

        # Инициализируем состояние галочки синхронной прокрутки
        self.sync_scroll_checkbox.config(state=tk.DISABLED)

        self.load_har_files()

    def create_widgets(self):
        """Создает виджеты интерфейса"""
        # Верхняя панель с настройками
        top_frame = ttk.Frame(self.root)
        top_frame.pack(fill=tk.X, padx=10, pady=5)

        # Кнопка обновления
        ttk.Button(top_frame, text="Обновить", command=self.load_har_files).pack(side=tk.LEFT, padx=5)

        # Чекбокс для режима сравнения
        ttk.Checkbutton(
            top_frame,
            text="Сравнивать только по ключам",
            variable=self.keys_only_var,
            command=self.update_comparison
        ).pack(side=tk.LEFT, padx=10)

        # Чекбокс для подгонки запросов
        ttk.Checkbutton(
            top_frame,
            text="Подогнать запросы один к одному",
            variable=self.align_requests_var,
            command=self.update_comparison
        ).pack(side=tk.LEFT, padx=10)

        # Чекбокс для синхронной прокрутки
        self.sync_scroll_checkbox = ttk.Checkbutton(
            top_frame,
            text="Синхронная прокрутка",
            variable=self.sync_scroll_var,
            command=self.setup_sync_scroll
        )
        self.sync_scroll_checkbox.pack(side=tk.LEFT, padx=10)

        # Информация о файлах
        self.info_label = ttk.Label(top_frame, text="Файлы не загружены")
        self.info_label.pack(side=tk.RIGHT, padx=5)

        # Основная панель с двумя списками
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # Левая панель (первый файл)
        left_frame = ttk.LabelFrame(main_frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        # Список запросов первого файла
        self.tree1 = ttk.Treeview(left_frame, columns=('method', 'path', 'status'), show='tree headings')
        self.tree1.heading('#0', text='#')
        self.tree1.heading('method', text='Method')
        self.tree1.heading('path', text='Path')
        self.tree1.heading('status', text='Status')

        self.tree1.column('#0', width=50)
        self.tree1.column('method', width=80)
        self.tree1.column('path', width=400)
        self.tree1.column('status', width=80)

        # Скроллбар для первого списка
        scrollbar1 = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.tree1.yview)
        self.tree1.configure(yscrollcommand=scrollbar1.set)

        self.tree1.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar1.pack(side=tk.RIGHT, fill=tk.Y)

        # Правая панель (второй файл)
        right_frame = ttk.LabelFrame(main_frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))

        # Список запросов второго файла
        self.tree2 = ttk.Treeview(right_frame, columns=('method', 'path', 'status'), show='tree headings')
        self.tree2.heading('#0', text='#')
        self.tree2.heading('method', text='Method')
        self.tree2.heading('path', text='Path')
        self.tree2.heading('status', text='Status')

        self.tree2.column('#0', width=50)
        self.tree2.column('method', width=80)
        self.tree2.column('path', width=400)
        self.tree2.column('status', width=80)

        # Скроллбар для второго списка
        scrollbar2 = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self.tree2.yview)
        self.tree2.configure(yscrollcommand=scrollbar2.set)

        self.tree2.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar2.pack(side=tk.RIGHT, fill=tk.Y)

        # Привязываем события клика для выбора запросов
        self.tree1.bind('<Button-1>', lambda e: self.on_select_request(self.tree1, 1))
        self.tree2.bind('<Button-1>', lambda e: self.on_select_request(self.tree2, 2))

        # Привязываем события двойного клика для детального просмотра
        self.tree1.bind('<Double-1>', lambda e: self.on_double_click())
        self.tree2.bind('<Double-1>', lambda e: self.on_double_click())

        # Настраиваем теги для цветовой индикации
        # Автоматическое сопоставление
        self.tree1.tag_configure('compared_match', background='lightgreen')
        self.tree1.tag_configure('compared_partial', background='lightyellow')
        self.tree1.tag_configure('compared_different', background='lightcoral')
        # Выбор пользователя (приоритет выше)
        self.tree1.tag_configure('selected', background='lightblue')

        self.tree2.tag_configure('compared_match', background='lightgreen')
        self.tree2.tag_configure('compared_partial', background='lightyellow')
        self.tree2.tag_configure('compared_different', background='lightcoral')
        # Выбор пользователя (приоритет выше)
        self.tree2.tag_configure('selected', background='lightblue')

        # Добавляем информационную панель
        info_frame = ttk.Frame(self.root)
        info_frame.pack(fill=tk.X, padx=10, pady=5)

        # Легенда цветов
        legend_frame = ttk.Frame(info_frame)
        legend_frame.pack(side=tk.LEFT)

        ttk.Label(legend_frame, text="🟢 Совпадают").pack(side=tk.LEFT, padx=5)
        ttk.Label(legend_frame, text="🟡 Частично").pack(side=tk.LEFT, padx=5)
        ttk.Label(legend_frame, text="🔴 Различаются").pack(side=tk.LEFT, padx=5)
        ttk.Label(legend_frame, text="🔵 Выбрано").pack(side=tk.LEFT, padx=5)

        # Информация о состоянии
        self.comparison_label = ttk.Label(info_frame, text="Загрузка...")
        self.comparison_label.pack(side=tk.LEFT, padx=20)

        # Кнопка для детального сравнения выбранных запросов
        self.compare_button = ttk.Button(info_frame, text="Детальное сравнение", command=self.show_detailed_comparison_selected, state=tk.DISABLED)
        self.compare_button.pack(side=tk.RIGHT, padx=5)

    def load_har_files(self):
        """Загружает HAR файлы из папки 'to compare'"""
        compare_dir = "to compare"
        if not os.path.exists(compare_dir):
            messagebox.showerror("Ошибка", f"Папка '{compare_dir}' не найдена")
            return

        har_files = [f for f in os.listdir(compare_dir) if f.endswith('.har')]

        if len(har_files) < 2:
            messagebox.showerror("Ошибка", f"В папке '{compare_dir}' должно быть минимум 2 HAR файла")
            return

        if len(har_files) > 2:
            messagebox.showwarning("Предупреждение", f"Найдено {len(har_files)} HAR файлов. Будут использованы первые два.")

        try:
            self.file1_path = os.path.join(compare_dir, har_files[0])
            self.file2_path = os.path.join(compare_dir, har_files[1])

            self.requests1 = HarParser.parse_har_file(self.file1_path)
            self.requests2 = HarParser.parse_har_file(self.file2_path)

            self.info_label.config(text=f"Файл 1: {har_files[0]} ({len(self.requests1)} запросов) | "
                                      f"Файл 2: {har_files[1]} ({len(self.requests2)} запросов)")

            self.update_comparison()

        except Exception as e:
            messagebox.showerror("Ошибка", f"Ошибка при загрузке файлов: {str(e)}")

    def update_comparison(self):
        """Обновляет отображение запросов с автоматическим сопоставлением"""
        if not self.requests1 and not self.requests2:
            return

        # Очищаем списки
        for item in self.tree1.get_children():
            self.tree1.delete(item)
        for item in self.tree2.get_children():
            self.tree2.delete(item)

        # Сбрасываем выбор
        self.selected_request1 = None
        self.selected_request2 = None
        self.selected_item1 = None
        self.selected_item2 = None
        self.compare_button.config(state=tk.DISABLED)

        if self.align_requests_var.get():
            # Используем алгоритм выравнивания как в VS Code
            self.comparison_label.config(text="Запросы выровнены один к одному. Кликните для детального сравнения.")
            # Включаем галочку синхронной прокрутки
            self.sync_scroll_checkbox.config(state=tk.NORMAL)
            aligned_pairs = RequestComparator.align_requests_like_vscode(self.requests1, self.requests2)

            for idx1, idx2 in aligned_pairs:
                # Обрабатываем левую сторону
                if idx1 is not None:
                    req1 = self.requests1[idx1]
                    full_path1 = req1.url if req1.url else req1.path

                    # Определяем тег для цвета
                    if idx2 is not None:
                        req2 = self.requests2[idx2]
                        comparison_result = RequestComparator.compare_requests(req1, req2, self.keys_only_var.get())
                        if comparison_result == 'match':
                            tag1 = 'compared_match'
                        elif comparison_result == 'partial':
                            tag1 = 'compared_partial'
                        else:
                            tag1 = 'compared_different'
                    else:
                        tag1 = 'compared_different'

                    self.tree1.insert('', 'end', text=str(idx1),
                                    values=(req1.method, full_path1, req1.response_status),
                                    tags=(tag1,))
                else:
                    # Пустая строка для выравнивания
                    self.tree1.insert('', 'end', text='-',
                                    values=('', '', ''),
                                    tags=('compared_different',))

                # Обрабатываем правую сторону
                if idx2 is not None:
                    req2 = self.requests2[idx2]
                    full_path2 = req2.url if req2.url else req2.path

                    # Определяем тег для цвета (такой же как слева)
                    if idx1 is not None:
                        req1 = self.requests1[idx1]
                        comparison_result = RequestComparator.compare_requests(req1, req2, self.keys_only_var.get())
                        if comparison_result == 'match':
                            tag2 = 'compared_match'
                        elif comparison_result == 'partial':
                            tag2 = 'compared_partial'
                        else:
                            tag2 = 'compared_different'
                    else:
                        tag2 = 'compared_different'

                    self.tree2.insert('', 'end', text=str(idx2),
                                    values=(req2.method, full_path2, req2.response_status),
                                    tags=(tag2,))
                else:
                    # Пустая строка для выравнивания
                    self.tree2.insert('', 'end', text='-',
                                    values=('', '', ''),
                                    tags=('compared_different',))
        else:
            # Обычное отображение по индексу
            self.comparison_label.config(text="Автоматическое сопоставление выполнено. Кликните на запросы для детального сравнения.")
            # Отключаем галочку синхронной прокрутки
            self.sync_scroll_checkbox.config(state=tk.DISABLED)
            self.sync_scroll_var.set(False)
            self.setup_sync_scroll()  # Сбрасываем синхронизацию

            # Отображаем запросы из первого файла по индексу
            for idx, req in enumerate(self.requests1):
                full_path = req.url if req.url else req.path
                self.tree1.insert('', 'end', text=str(idx),
                                values=(req.method, full_path, req.response_status),
                                tags=())

            # Отображаем запросы из второго файла по индексу
            for idx, req in enumerate(self.requests2):
                full_path = req.url if req.url else req.path
                self.tree2.insert('', 'end', text=str(idx),
                                values=(req.method, full_path, req.response_status),
                                tags=())

    def setup_sync_scroll(self):
        """Настраивает синхронную прокрутку списков"""
        if self.sync_scroll_var.get():
            # Включаем синхронную прокрутку
            # Привязываем события прокрутки к скроллбарам
            self.tree1.configure(yscrollcommand=self.on_tree1_scroll)
            self.tree2.configure(yscrollcommand=self.on_tree2_scroll)
        else:
            # Отключаем синхронную прокрутку - возвращаем обычные скроллбары
            scrollbar1 = None
            scrollbar2 = None
            # Находим скроллбары (они должны быть в родительских фреймах)
            for widget in self.tree1.master.winfo_children():
                if isinstance(widget, ttk.Scrollbar):
                    scrollbar1 = widget
                    break
            for widget in self.tree2.master.winfo_children():
                if isinstance(widget, ttk.Scrollbar):
                    scrollbar2 = widget
                    break

            if scrollbar1:
                self.tree1.configure(yscrollcommand=scrollbar1.set)
            if scrollbar2:
                self.tree2.configure(yscrollcommand=scrollbar2.set)

    def on_tree1_scroll(self, *args):
        """Обработчик прокрутки первого списка"""
        if not self.scrolling_in_progress and self.sync_scroll_var.get():
            self.scrolling_in_progress = True

            # Синхронизируем прокрутку второго списка
            self.tree2.yview_moveto(args[0])

            # Обновляем скроллбар первого списка
            scrollbar1 = None
            for widget in self.tree1.master.winfo_children():
                if isinstance(widget, ttk.Scrollbar):
                    scrollbar1 = widget
                    break
            if scrollbar1:
                scrollbar1.set(*args)

            self.scrolling_in_progress = False

    def on_tree2_scroll(self, *args):
        """Обработчик прокрутки второго списка"""
        if not self.scrolling_in_progress and self.sync_scroll_var.get():
            self.scrolling_in_progress = True

            # Синхронизируем прокрутку первого списка
            self.tree1.yview_moveto(args[0])

            # Обновляем скроллбар второго списка
            scrollbar2 = None
            for widget in self.tree2.master.winfo_children():
                if isinstance(widget, ttk.Scrollbar):
                    scrollbar2 = widget
                    break
            if scrollbar2:
                scrollbar2.set(*args)

            self.scrolling_in_progress = False

    def on_select_request(self, tree, file_num):
        """Обработчик выбора запроса для детального сравнения"""
        selection = tree.selection()
        if not selection:
            return

        item = tree.item(selection[0])
        index_text = item['text']
        current_tags = item['tags']

        try:
            index = int(index_text)

            if file_num == 1:
                # Восстанавливаем предыдущий цвет
                if self.selected_item1:
                    old_item = self.tree1.item(self.selected_item1)
                    old_tags = [tag for tag in old_item['tags'] if tag != 'selected']
                    self.tree1.item(self.selected_item1, tags=old_tags)

                # Устанавливаем новое выделение
                self.selected_request1 = self.requests1[index] if index < len(self.requests1) else None
                self.selected_item1 = selection[0]

                # Добавляем тег selected к существующим тегам
                new_tags = list(current_tags) + ['selected']
                self.tree1.item(selection[0], tags=new_tags)

            elif file_num == 2:
                # Восстанавливаем предыдущий цвет
                if self.selected_item2:
                    old_item = self.tree2.item(self.selected_item2)
                    old_tags = [tag for tag in old_item['tags'] if tag != 'selected']
                    self.tree2.item(self.selected_item2, tags=old_tags)

                # Устанавливаем новое выделение
                self.selected_request2 = self.requests2[index] if index < len(self.requests2) else None
                self.selected_item2 = selection[0]

                # Добавляем тег selected к существующим тегам
                new_tags = list(current_tags) + ['selected']
                self.tree2.item(selection[0], tags=new_tags)

            # Обновляем состояние кнопки сравнения
            if self.selected_request1 and self.selected_request2:
                self.compare_button.config(state=tk.NORMAL)
                idx1 = self.requests1.index(self.selected_request1)
                idx2 = self.requests2.index(self.selected_request2)
                self.comparison_label.config(text=f"Выбраны для детального сравнения: [{idx1}] {self.selected_request1.method} vs [{idx2}] {self.selected_request2.method}")
            else:
                self.compare_button.config(state=tk.DISABLED)
                selected_info = ""
                if self.selected_request1:
                    idx1 = self.requests1.index(self.selected_request1)
                    selected_info += f"Файл 1: [{idx1}] {self.selected_request1.method} "
                if self.selected_request2:
                    idx2 = self.requests2.index(self.selected_request2)
                    selected_info += f"Файл 2: [{idx2}] {self.selected_request2.method}"
                if selected_info:
                    self.comparison_label.config(text=selected_info + " - выберите второй запрос")
                else:
                    self.comparison_label.config(text="Кликните на запросы для детального сравнения")

        except (ValueError, IndexError):
            pass

    def show_detailed_comparison_selected(self):
        """Показывает детальное сравнение выбранных запросов"""
        if not self.selected_request1 or not self.selected_request2:
            messagebox.showinfo("Информация", "Сначала выберите два запроса для сравнения")
            return

        self.show_detailed_comparison(self.selected_request1, self.selected_request2)

    def on_double_click(self):
        """Обработчик двойного клика для детального просмотра"""
        if self.selected_request1 and self.selected_request2:
            self.show_detailed_comparison(self.selected_request1, self.selected_request2)
        else:
            messagebox.showinfo("Информация", "Сначала выберите два запроса для сравнения")



    def show_detailed_comparison(self, req1, req2):
        """Показывает детальное сравнение запросов"""
        detail_window = tk.Toplevel(self.root)
        detail_window.title("Детальное сравнение запросов")
        detail_window.geometry("1400x900")

        # Создаем переменную для режима сравнения в детальном окне
        detail_keys_only_var = tk.BooleanVar()

        # Верхняя панель с настройками
        top_frame = ttk.Frame(detail_window)
        top_frame.pack(fill=tk.X, padx=10, pady=5)

        # Чекбокс для режима сравнения в детальном окне
        ttk.Checkbutton(
            top_frame,
            text="Сравнивать только по ключам",
            variable=detail_keys_only_var,
            command=lambda: self.update_detailed_comparison(notebook, req1, req2, detail_keys_only_var.get())
        ).pack(side=tk.LEFT, padx=5)

        # Информация о сравниваемых запросах
        info_text = f"Сравнение: [{req1.index if req1 else 'N/A'}] {req1.method if req1 else 'N/A'} vs [{req2.index if req2 else 'N/A'}] {req2.method if req2 else 'N/A'}"
        ttk.Label(top_frame, text=info_text).pack(side=tk.RIGHT, padx=5)

        # Информация о режиме
        mode_text = "Режим: показывается вся строка, сравнение " + ("только по ключам" if detail_keys_only_var.get() else "полное")
        ttk.Label(top_frame, text=mode_text, font=('Arial', 8)).pack(side=tk.RIGHT, padx=20)

        # Создаем notebook для вкладок
        notebook = ttk.Notebook(detail_window)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # Сохраняем ссылки для обновления
        detail_window.notebook = notebook
        detail_window.req1 = req1
        detail_window.req2 = req2
        detail_window.keys_only_var = detail_keys_only_var

        # Создаем вкладки
        self.create_detailed_tabs(notebook, req1, req2, detail_keys_only_var.get())

    def create_detailed_tabs(self, notebook, req1, req2, keys_only=False):
        """Создает все вкладки для детального сравнения"""
        # Очищаем существующие вкладки
        for tab in notebook.tabs():
            notebook.forget(tab)

        # Вкладка для сравнения общей информации
        self.create_general_comparison_tab(notebook, req1, req2, keys_only)

        # Вкладка для сравнения заголовков
        self.create_headers_comparison_tab(notebook, req1, req2, keys_only)

        # Вкладка для сравнения параметров запроса
        self.create_params_comparison_tab(notebook, req1, req2, keys_only)

        # Вкладка для сравнения тела запроса
        if (req1 and req1.post_data) or (req2 and req2.post_data):
            self.create_body_comparison_tab(notebook, req1, req2, keys_only)

        # Вкладка для сравнения ответов
        self.create_response_comparison_tab(notebook, req1, req2, keys_only)

    def update_detailed_comparison(self, notebook, req1, req2, keys_only):
        """Обновляет детальное сравнение при изменении режима"""
        # Сохраняем текущую активную вкладку
        current_tab = notebook.index(notebook.select()) if notebook.tabs() else 0

        # Пересоздаем вкладки
        self.create_detailed_tabs(notebook, req1, req2, keys_only)

        # Восстанавливаем активную вкладку
        if notebook.tabs() and current_tab < len(notebook.tabs()):
            notebook.select(current_tab)

    def create_general_comparison_tab(self, notebook, req1, req2, keys_only=False):
        """Создает вкладку для сравнения общей информации"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="Общая информация")

        # Создаем два столбца
        left_frame = ttk.LabelFrame(frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5), pady=5)

        right_frame = ttk.LabelFrame(frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0), pady=5)

        # Информация о первом запросе
        if req1:
            info1 = f"Index: {req1.index}\nMethod: {req1.method}\nURL: {req1.url}\nPath: {req1.path}\nResponse Status: {req1.response_status}"
        else:
            info1 = "Запрос отсутствует"

        text1 = tk.Text(left_frame, wrap=tk.WORD, font=('Consolas', 10))
        text1.insert('1.0', info1)
        text1.config(state=tk.DISABLED)
        text1.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Информация о втором запросе
        if req2:
            info2 = f"Index: {req2.index}\nMethod: {req2.method}\nURL: {req2.url}\nPath: {req2.path}\nResponse Status: {req2.response_status}"
        else:
            info2 = "Запрос отсутствует"

        text2 = tk.Text(right_frame, wrap=tk.WORD, font=('Consolas', 10))
        text2.insert('1.0', info2)
        text2.config(state=tk.DISABLED)
        text2.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Подсвечиваем различия с учетом режима
        self.highlight_differences_with_mode(text1, text2, info1, info2, req1, req2, keys_only, 'general')

    def create_headers_comparison_tab(self, notebook, req1, req2, keys_only=False):
        """Создает вкладку для сравнения заголовков"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="Заголовки")

        # Создаем два столбца
        left_frame = ttk.LabelFrame(frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5), pady=5)

        right_frame = ttk.LabelFrame(frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0), pady=5)

        # Заголовки первого запроса
        # В любом режиме показываем полную строку, но сравнение будет разное
        headers1 = JsonFormatter.format_headers_dict(req1.headers if req1 else {})

        text1 = tk.Text(left_frame, wrap=tk.WORD, font=('Consolas', 10))
        text1.insert('1.0', headers1)
        text1.config(state=tk.DISABLED)
        text1.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Заголовки второго запроса
        # В любом режиме показываем полную строку, но сравнение будет разное
        headers2 = JsonFormatter.format_headers_dict(req2.headers if req2 else {})

        text2 = tk.Text(right_frame, wrap=tk.WORD, font=('Consolas', 10))
        text2.insert('1.0', headers2)
        text2.config(state=tk.DISABLED)
        text2.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Подсвечиваем различия с учетом режима
        self.highlight_differences_with_mode(text1, text2, headers1, headers2, req1, req2, keys_only, 'headers')

    def create_params_comparison_tab(self, notebook, req1, req2, keys_only=False):
        """Создает вкладку для сравнения параметров запроса"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="Параметры")

        # Создаем два столбца
        left_frame = ttk.LabelFrame(frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5), pady=5)

        right_frame = ttk.LabelFrame(frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0), pady=5)

        # Параметры первого запроса
        # В любом режиме показываем полную строку, но сравнение будет разное
        params1 = JsonFormatter.format_params_dict(req1.query_params if req1 else {})

        text1 = tk.Text(left_frame, wrap=tk.WORD, font=('Consolas', 10))
        text1.insert('1.0', params1)
        text1.config(state=tk.DISABLED)
        text1.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Параметры второго запроса
        # В любом режиме показываем полную строку, но сравнение будет разное
        params2 = JsonFormatter.format_params_dict(req2.query_params if req2 else {})

        text2 = tk.Text(right_frame, wrap=tk.WORD, font=('Consolas', 10))
        text2.insert('1.0', params2)
        text2.config(state=tk.DISABLED)
        text2.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Подсвечиваем различия с учетом режима
        self.highlight_differences_with_mode(text1, text2, params1, params2, req1, req2, keys_only, 'params')

    def create_body_comparison_tab(self, notebook, req1, req2, keys_only=False):
        """Создает вкладку для сравнения тела запроса"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="Тело запроса")

        # Создаем два столбца
        left_frame = ttk.LabelFrame(frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5), pady=5)

        right_frame = ttk.LabelFrame(frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0), pady=5)

        # Тело первого запроса с форматированием JSON
        if req1 and req1.post_data:
            # В любом режиме показываем полную строку, но сравнение будет разное
            body1 = JsonFormatter.format_json_string(req1.post_data)
        else:
            body1 = "Тело запроса отсутствует"

        text1 = tk.Text(left_frame, wrap=tk.WORD, font=('Consolas', 10))
        text1.insert('1.0', body1)
        text1.config(state=tk.DISABLED)
        text1.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Тело второго запроса с форматированием JSON
        if req2 and req2.post_data:
            # В любом режиме показываем полную строку, но сравнение будет разное
            body2 = JsonFormatter.format_json_string(req2.post_data)
        else:
            body2 = "Тело запроса отсутствует"

        text2 = tk.Text(right_frame, wrap=tk.WORD, font=('Consolas', 10))
        text2.insert('1.0', body2)
        text2.config(state=tk.DISABLED)
        text2.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Подсвечиваем различия с учетом режима
        self.highlight_differences_with_mode(text1, text2, body1, body2, req1, req2, keys_only, 'body')

    def create_response_comparison_tab(self, notebook, req1, req2, keys_only=False):
        """Создает вкладку для сравнения ответов"""
        frame = ttk.Frame(notebook)
        notebook.add(frame, text="Ответы")

        # Создаем два столбца
        left_frame = ttk.LabelFrame(frame, text="Файл 1")
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5), pady=5)

        right_frame = ttk.LabelFrame(frame, text="Файл 2")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0), pady=5)

        # Ответ первого запроса
        if req1:
            response1 = f"Status: {req1.response_status}\n\nHeaders:\n"
            # В любом режиме показываем полную строку, но сравнение будет разное
            response1 += JsonFormatter.format_headers_dict(req1.response_headers)

            response1 += "\n\nBody:\n"
            if req1.response_body:
                response1 += JsonFormatter.format_json_string(req1.response_body)
            else:
                response1 += "Отсутствует"
        else:
            response1 = "Ответ отсутствует"

        text1 = tk.Text(left_frame, wrap=tk.WORD, font=('Consolas', 10))
        text1.insert('1.0', response1)
        text1.config(state=tk.DISABLED)
        text1.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Ответ второго запроса
        if req2:
            response2 = f"Status: {req2.response_status}\n\nHeaders:\n"
            # В любом режиме показываем полную строку, но сравнение будет разное
            response2 += JsonFormatter.format_headers_dict(req2.response_headers)

            response2 += "\n\nBody:\n"
            if req2.response_body:
                response2 += JsonFormatter.format_json_string(req2.response_body)
            else:
                response2 += "Отсутствует"
        else:
            response2 = "Ответ отсутствует"

        text2 = tk.Text(right_frame, wrap=tk.WORD, font=('Consolas', 10))
        text2.insert('1.0', response2)
        text2.config(state=tk.DISABLED)
        text2.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Подсвечиваем различия с учетом режима
        self.highlight_differences_with_mode(text1, text2, response1, response2, req1, req2, keys_only, 'response')

    def highlight_differences(self, text1, text2, content1, content2):
        """Подсвечивает различия между двумя текстами построчно"""
        # Очищаем все существующие теги
        for tag in text1.tag_names():
            text1.tag_delete(tag)
        for tag in text2.tag_names():
            text2.tag_delete(tag)

        # Настраиваем теги для подсветки
        text1.tag_configure('different', background='lightcoral')
        text2.tag_configure('different', background='lightcoral')
        text1.tag_configure('same', background='lightgreen')
        text2.tag_configure('same', background='lightgreen')
        text1.tag_configure('missing', background='lightgray')
        text2.tag_configure('missing', background='lightgray')

        # Разбиваем на строки
        lines1 = content1.split('\n')
        lines2 = content2.split('\n')

        # Используем difflib для построчного сравнения
        matcher = difflib.SequenceMatcher(None, lines1, lines2)

        # Получаем операции сравнения
        opcodes = matcher.get_opcodes()

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == 'equal':
                # Одинаковые строки - подсвечиваем зеленым
                for line_num in range(i1, i2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text1.tag_add('same', start_pos, end_pos)

                for line_num in range(j1, j2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text2.tag_add('same', start_pos, end_pos)

            elif tag == 'delete':
                # Строки есть только в первом тексте
                for line_num in range(i1, i2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text1.tag_add('different', start_pos, end_pos)

            elif tag == 'insert':
                # Строки есть только во втором тексте
                for line_num in range(j1, j2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text2.tag_add('different', start_pos, end_pos)

            elif tag == 'replace':
                # Строки отличаются
                for line_num in range(i1, i2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text1.tag_add('different', start_pos, end_pos)

                for line_num in range(j1, j2):
                    start_pos = f"{line_num + 1}.0"
                    end_pos = f"{line_num + 1}.end"
                    text2.tag_add('different', start_pos, end_pos)

    def highlight_differences_with_mode(self, text1, text2, content1, content2, req1, req2, keys_only, content_type):
        """Подсвечивает различия с учетом режима сравнения"""
        if keys_only:
            # В режиме "только по ключам" сравниваем только ключи
            if content_type == 'general':
                # Для общей информации сравниваем основные поля
                if req1 and req2:
                    # Сравниваем method, path (без параметров), response_status
                    method_match = req1.method == req2.method
                    path_match = req1.path.split('?')[0] == req2.path.split('?')[0]  # Путь без параметров
                    status_match = req1.response_status == req2.response_status

                    if method_match and path_match and status_match:
                        # Основные поля совпадают - подсвечиваем зеленым
                        self.highlight_as_same(text1, text2)
                    else:
                        # Основные поля различаются - подсвечиваем различия
                        self.highlight_differences(text1, text2, content1, content2)
                else:
                    # Один из запросов отсутствует - подсвечиваем различия
                    self.highlight_differences(text1, text2, content1, content2)

            elif content_type == 'headers':
                # Сравниваем ключи заголовков
                keys1 = set(req1.headers.keys()) if req1 and req1.headers else set()
                keys2 = set(req2.headers.keys()) if req2 and req2.headers else set()

                if keys1 == keys2:
                    # Ключи одинаковые - подсвечиваем зеленым
                    self.highlight_as_same(text1, text2)
                else:
                    # Ключи разные - подсвечиваем различия
                    self.highlight_differences(text1, text2, content1, content2)

            elif content_type == 'params':
                # Сравниваем ключи параметров
                keys1 = set(req1.query_params.keys()) if req1 and req1.query_params else set()
                keys2 = set(req2.query_params.keys()) if req2 and req2.query_params else set()

                if keys1 == keys2:
                    # Ключи одинаковые - подсвечиваем зеленым
                    self.highlight_as_same(text1, text2)
                else:
                    # Ключи разные - подсвечиваем различия
                    self.highlight_differences(text1, text2, content1, content2)

            elif content_type == 'body':
                # Для тела запроса пытаемся сравнить ключи JSON
                try:
                    json1 = json.loads(req1.post_data) if req1 and req1.post_data else {}
                    json2 = json.loads(req2.post_data) if req2 and req2.post_data else {}

                    if isinstance(json1, dict) and isinstance(json2, dict):
                        keys1 = set(json1.keys())
                        keys2 = set(json2.keys())

                        if keys1 == keys2:
                            # Ключи одинаковые - подсвечиваем зеленым
                            self.highlight_as_same(text1, text2)
                        else:
                            # Ключи разные - подсвечиваем различия
                            self.highlight_differences(text1, text2, content1, content2)
                    else:
                        # Не JSON объекты - обычное сравнение
                        self.highlight_differences(text1, text2, content1, content2)
                except:
                    # Ошибка парсинга JSON - обычное сравнение
                    self.highlight_differences(text1, text2, content1, content2)

            elif content_type == 'response':
                # Для ответов сравниваем ключи заголовков и тела ответа
                try:
                    # Ключи заголовков ответа
                    resp_keys1 = set(req1.response_headers.keys()) if req1 and req1.response_headers else set()
                    resp_keys2 = set(req2.response_headers.keys()) if req2 and req2.response_headers else set()

                    # Ключи тела ответа (если JSON)
                    body_keys1 = set()
                    body_keys2 = set()

                    if req1 and req1.response_body:
                        try:
                            json1 = json.loads(req1.response_body)
                            if isinstance(json1, dict):
                                body_keys1 = set(json1.keys())
                        except:
                            pass

                    if req2 and req2.response_body:
                        try:
                            json2 = json.loads(req2.response_body)
                            if isinstance(json2, dict):
                                body_keys2 = set(json2.keys())
                        except:
                            pass

                    # Сравниваем статус, ключи заголовков и ключи тела
                    status1 = req1.response_status if req1 else 0
                    status2 = req2.response_status if req2 else 0

                    if status1 == status2 and resp_keys1 == resp_keys2 and body_keys1 == body_keys2:
                        # Все ключи одинаковые - подсвечиваем зеленым
                        self.highlight_as_same(text1, text2)
                    else:
                        # Есть различия - подсвечиваем различия
                        self.highlight_differences(text1, text2, content1, content2)

                except:
                    # Ошибка - обычное сравнение
                    self.highlight_differences(text1, text2, content1, content2)
        else:
            # В обычном режиме используем полное сравнение
            self.highlight_differences(text1, text2, content1, content2)

    def highlight_as_same(self, text1, text2):
        """Подсвечивает весь текст как одинаковый (зеленым)"""
        # Очищаем все существующие теги
        for tag in text1.tag_names():
            text1.tag_delete(tag)
        for tag in text2.tag_names():
            text2.tag_delete(tag)

        # Настраиваем теги
        text1.tag_configure('keys_same', background='lightgreen')
        text2.tag_configure('keys_same', background='lightgreen')

        # Подсвечиваем весь текст зеленым
        text1.tag_add('keys_same', '1.0', 'end')
        text2.tag_add('keys_same', '1.0', 'end')


if __name__ == "__main__":
    app = HarCompareGUI()
    app.root.mainloop()