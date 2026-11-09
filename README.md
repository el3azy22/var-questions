# بنك أسئلة ڤار VAR

لعبة «ڤار» تقرا هالملف `questions.json` كل ما تنفتح وفيها نت، وتحفظ آخر نسخة عشان تشتغل بدون نت.

## شكل السؤال

```json
{
  "c": "season",
  "q": "نص السؤال؟",
  "a": ["الجواب الصح", "غلط", "غلط", "غلط"],
  "e": "شرح يطلع بعد الجواب",
  "club": "ain"
}
```

- `c` التصنيف: season، history، cups، asia، clubs، stars، crests، career، ref
- `a` الجواب الصح دايماً أول واحد، واللعبة تخلط الترتيب
- `club` و `img` اختياريات، ومفاتيح الأندية هي: ain، shabab، wasl، jazira، wahda، sharjah، nasr، ajman، kalba، khorfakkan، baniyas، dhafra، hatta، united

أي سؤال شكله غلط اللعبة تتجاهله، ولو الملف كله خربان تكمل على النسخة القديمة.
