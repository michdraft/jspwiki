<%@ taglib uri="/WEB-INF/jspwiki.tld" prefix="wiki" %>

<!DOCTYPE html 
     PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
     "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html>

<head>
  <title><wiki:Variable var="applicationname" />: <wiki:PageName /></title>
  <wiki:Include page="commonheader.jsp"/>
  <wiki:CheckVersion mode="notlatest">
        <meta name="robots" content="noindex,nofollow" />
  </wiki:CheckVersion>
</head>

<body class="view" bgcolor="#FFFFFF">
<a name="Top"></a>

<div id="wikibody" >

  <wiki:Include page="Header.jsp" />

  <div id="actionsTop"><wiki:Include page="PageActions.jsp"/></div>

  <div id="page"><wiki:Content/></div>

  <div id="favorites"><wiki:Include page="Favorites.jsp"/></div>

  <div id="actionsBottom"><wiki:Include page="PageActions.jsp"/></div>

  <wiki:Include page="Footer.jsp" />

  <div style="clear:both; height:0px;" > </div>

</div>
<a name="Bottom"></a>

</body>
</html>

