namespace dell.scarf.assemble.models.responses;

public class SNPRecommendationsResponse
{
    public string Title { get; set; }
    public string Description { get; set; }
    public List<SNPRecommendationTab> Tabs { get; set; } = new();
}

public class SNPRecommendationTab
{
    public string Persona { get; set; }
    public string Label { get; set; }
    public List<SNPRecommendationCategory> Categories { get; set; } = new();
    public List<SNPRecommendationProduct> Products { get; set; } = new();
}

public class SNPRecommendationCategory
{
    public string Key { get; set; }
    public string Name { get; set; }
}

public class SNPRecommendationProduct
{
    public string Id { get; set; }
    public string Title { get; set; }
    public string Link { get; set; }
    public string Image { get; set; }
    public string ImageAlt { get; set; }
    public string Rating { get; set; }
    public string ReviewCount { get; set; }
    public string Price { get; set; }
    public string OriginalPrice { get; set; }
    public string Category { get; set; }
}
